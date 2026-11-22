import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  User,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import {
  CustomFunctionToolDef,
  FontPresetId,
  InstructionProfile,
} from './types/chat';
import { studioLogger } from './utils/studioLogger';

export function isBluxliMeEmail(email?: string | null): boolean {
  if (!email) return false;
  return /^[^@]+@([a-z0-9-]+\.)*bluxli\.me$/i.test(email.trim());
}

export function isAccountAccessAllowed(user: User | null): boolean {
  if (!user) return false;
  return Boolean(user.emailVerified || isBluxliMeEmail(user.email));
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export interface UserAccountProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  emailVerified: boolean;
  fontPreset?: FontPresetId;
  defaultPureCode?: boolean;
}

export async function signInWithGooglePopup(): Promise<UserAccountProfile> {
  const cred = await signInWithPopup(auth, googleProvider);
  const user = cred.user;
  if (isAccountAccessAllowed(user)) {
    await ensureUserProfileDoc(user);
    studioLogger.success('Auth', `Signed in via Google as ${user.email || user.uid}`);
  }
  return {
    uid: user.uid,
    displayName: user.displayName || user.email?.split('@')[0] || 'Folio User',
    email: user.email || '',
    photoURL: user.photoURL || undefined,
    emailVerified: isAccountAccessAllowed(user),
  };
}

export async function signInWithEmailPassword(
  email: string,
  password: string
): Promise<{ user: User; requiresVerification: boolean }> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  const user = cred.user;
  const allowed = isAccountAccessAllowed(user);
  if (allowed) {
    await ensureUserProfileDoc(user);
    studioLogger.success(
      'Auth',
      isBluxliMeEmail(user.email)
        ? `Signed in @bluxli.me owner account (${user.email}) — password verified.`
        : `Signed in verified account (${user.email}).`
    );
  } else {
    studioLogger.warn(
      'Auth',
      `Signed in ${user.email}, awaiting email verification (non-bluxli.me domain).`
    );
  }
  return { user, requiresVerification: !allowed };
}

export async function signUpWithEmailPassword(
  email: string,
  password: string,
  displayName?: string
): Promise<{ user: User; requiresVerification: boolean }> {
  const cleanEmail = email.trim();
  const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
  const user = cred.user;
  if (displayName?.trim()) {
    await updateProfile(user, { displayName: displayName.trim().slice(0, 120) });
  }
  const isOwnerDomain = isBluxliMeEmail(cleanEmail);
  if (isOwnerDomain) {
    await ensureUserProfileDoc(user);
    studioLogger.success('Auth', `Registered @bluxli.me owner account (${cleanEmail}) — email verification skipped.`);
    return { user, requiresVerification: false };
  }
  await sendEmailVerification(user);
  studioLogger.warn('Auth', `Registered ${cleanEmail} — verification link sent.`);
  return { user, requiresVerification: true };
}

export async function resendAccountVerification(user: User): Promise<void> {
  await sendEmailVerification(user);
  studioLogger.log('Auth', `Re-sent verification email to ${user.email || 'account'}.`);
}

export async function refreshCurrentUser(): Promise<User | null> {
  if (!auth.currentUser) return null;
  await reload(auth.currentUser);
  return auth.currentUser;
}

export async function signOutAccount(): Promise<void> {
  await signOut(auth);
  studioLogger.log('Auth', 'Signed out of Folio account.');
}

export function subscribeAuthUser(
  callback: (user: User | null) => void
): () => void {
  return onAuthStateChanged(auth, callback);
}

export async function ensureUserProfileDoc(
  user: User,
  prefs?: { fontPreset?: FontPresetId; defaultPureCode?: boolean }
): Promise<void> {
  if (!isAccountAccessAllowed(user)) return;
  const userPath = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(ref);
    const displayName = (
      user.displayName ||
      user.email?.split('@')[0] ||
      'Folio User'
    ).slice(0, 120);
    const email = (user.email || `${user.uid}@folio.local`).slice(0, 254);

    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        email,
        displayName,
        ...(user.photoURL ? { photoURL: user.photoURL.slice(0, 1024) } : {}),
        ...(prefs?.fontPreset ? { fontPreset: prefs.fontPreset } : {}),
        ...(typeof prefs?.defaultPureCode === 'boolean'
          ? { defaultPureCode: prefs.defaultPureCode }
          : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else if (prefs) {
      await updateDoc(ref, {
        ...(prefs.fontPreset ? { fontPreset: prefs.fontPreset } : {}),
        ...(typeof prefs.defaultPureCode === 'boolean'
          ? { defaultPureCode: prefs.defaultPureCode }
          : {}),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export async function fetchUserPreferences(
  uid: string
): Promise<{ fontPreset?: FontPresetId; defaultPureCode?: boolean } | null> {
  const userPath = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      fontPreset: data.fontPreset as FontPresetId | undefined,
      defaultPureCode:
        typeof data.defaultPureCode === 'boolean'
          ? data.defaultPureCode
          : undefined,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }
}

export function subscribeCustomInstructions(
  uid: string,
  onData: (items: InstructionProfile[]) => void,
  onError?: (err: Error) => void
): () => void {
  const colPath = `users/${uid}/instructions`;
  const q = query(
    collection(db, colPath),
    where('ownerId', '==', uid),
    orderBy('updatedAt', 'desc')
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const items: InstructionProfile[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: String(data.name || 'Untitled'),
          instruction: String(data.instruction || ''),
          createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
          updatedAt: data.updatedAt?.toMillis?.() ?? Date.now(),
        };
      });
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, colPath);
      } catch (wrapped) {
        onError?.(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function saveCustomInstruction(
  uid: string,
  profile: { id: string; name: string; instruction: string },
  isNew: boolean
): Promise<void> {
  const safeId = profile.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const path = `users/${uid}/instructions/${safeId}`;
  const ref = doc(db, 'users', uid, 'instructions', safeId);
  try {
    if (isNew) {
      await setDoc(ref, {
        id: safeId,
        ownerId: uid,
        name: profile.name.trim().slice(0, 120) || 'Custom Instruction',
        instruction: profile.instruction.trim().slice(0, 16000),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        name: profile.name.trim().slice(0, 120) || 'Custom Instruction',
        instruction: profile.instruction.trim().slice(0, 16000),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(
      error,
      isNew ? OperationType.CREATE : OperationType.UPDATE,
      path
    );
  }
}

export async function deleteCustomInstruction(
  uid: string,
  id: string
): Promise<void> {
  const path = `users/${uid}/instructions/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'instructions', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeCustomTools(
  uid: string,
  onData: (items: CustomFunctionToolDef[]) => void,
  onError?: (err: Error) => void
): () => void {
  const colPath = `users/${uid}/tools`;
  const q = query(
    collection(db, colPath),
    where('ownerId', '==', uid),
    orderBy('updatedAt', 'desc')
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const items: CustomFunctionToolDef[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: String(data.name || ''),
          description: String(data.description || ''),
          parametersJson: String(data.parametersJson || '{}'),
          handlerCode: String(data.handlerCode || 'return { ok: true, args };'),
          enabled: Boolean(data.enabled),
          createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
          updatedAt: data.updatedAt?.toMillis?.() ?? Date.now(),
        };
      });
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, colPath);
      } catch (wrapped) {
        onError?.(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function saveCustomTool(
  uid: string,
  tool: Omit<CustomFunctionToolDef, 'createdAt' | 'updatedAt'>,
  isNew: boolean
): Promise<void> {
  const safeId = tool.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const path = `users/${uid}/tools/${safeId}`;
  const ref = doc(db, 'users', uid, 'tools', safeId);
  try {
    if (isNew) {
      await setDoc(ref, {
        id: safeId,
        ownerId: uid,
        name: tool.name.trim().slice(0, 64),
        description: tool.description.trim().slice(0, 512),
        parametersJson: tool.parametersJson.slice(0, 8000),
        handlerCode: tool.handlerCode.slice(0, 16000),
        enabled: Boolean(tool.enabled),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        name: tool.name.trim().slice(0, 64),
        description: tool.description.trim().slice(0, 512),
        parametersJson: tool.parametersJson.slice(0, 8000),
        handlerCode: tool.handlerCode.slice(0, 16000),
        enabled: Boolean(tool.enabled),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(
      error,
      isNew ? OperationType.CREATE : OperationType.UPDATE,
      path
    );
  }
}

export async function deleteCustomTool(uid: string, id: string): Promise<void> {
  const path = `users/${uid}/tools/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'tools', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
