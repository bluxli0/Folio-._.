import React, { useState } from 'react';
import { User } from 'firebase/auth';
import {
  Check,
  Code2,
  FileText,
  LogIn,
  LogOut,
  MailCheck,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Type,
  Wrench,
  X,
} from 'lucide-react';
import {
  isAccountAccessAllowed,
  isBluxliMeEmail,
  refreshCurrentUser,
  resendAccountVerification,
  signInWithEmailPassword,
  signInWithGooglePopup,
  signOutAccount,
  signUpWithEmailPassword,
} from '../firebase';
import { FontPresetId } from '../types/chat';
import { FONT_PRESETS } from '../utils/textFormatting';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  fontPreset: FontPresetId;
  onChangeFontPreset: (preset: FontPresetId) => void;
  defaultPureCode: boolean;
  onToggleDefaultPureCode: (v: boolean) => void;
  instructionsCount: number;
  toolsCount: number;
  onOpenInstructions: () => void;
  onOpenTools: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  user,
  fontPreset,
  onChangeFontPreset,
  defaultPureCode,
  onToggleDefaultPureCode,
  instructionsCount,
  toolsCount,
  onOpenInstructions,
  onOpenTools,
}) => {
  const [busy, setBusy] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const initials = (user?.displayName || user?.email || 'F')
    .split(/\s+/)
    .slice(0, 2)
    .map((s: string) => s[0]?.toUpperCase() || '')
    .join('');

  const inputIsBluxli = isBluxliMeEmail(emailInput);
  const userIsBluxli = isBluxliMeEmail(user?.email);
  const userAllowed = isAccountAccessAllowed(user);

  const handleGoogleSignIn = async () => {
    setBusy(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      await signInWithGooglePopup();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Google Sign-In could not be completed.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || !passwordInput) return;
    setBusy(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      if (authMode === 'signup') {
        const res = await signUpWithEmailPassword(
          emailInput,
          passwordInput,
          displayNameInput
        );
        if (res.requiresVerification) {
          setStatusMsg(
            `Verification email sent to ${emailInput.trim()}. Please verify your inbox, then click Refresh Verification.`
          );
        } else {
          setStatusMsg(
            '@bluxli.me owner account verified via password — full cloud sync unlocked.'
          );
        }
      } else {
        const res = await signInWithEmailPassword(emailInput, passwordInput);
        if (res.requiresVerification) {
          setStatusMsg(
            'Email verification is still pending for this domain. Verify your inbox or resend verification.'
          );
        } else {
          setStatusMsg(
            isBluxliMeEmail(res.user.email)
              ? '@bluxli.me owner login accepted (password-only pass).'
              : 'Signed in successfully.'
          );
        }
      }
      setPasswordInput('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Authentication failed.';
      if (msg.includes('operation-not-allowed')) {
        setErrorMsg(
          'Email/Password sign-in is disabled in the Firebase project console. Enable Email/Password under Authentication > Sign-in method or use Google Sign-In.'
        );
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleResendVerification = async () => {
    if (!user) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      await resendAccountVerification(user);
      setStatusMsg(`Verification link re-sent to ${user.email}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to send verification email.');
    } finally {
      setBusy(false);
    }
  };

  const handleRefreshUser = async () => {
    setBusy(true);
    setErrorMsg(null);
    try {
      const refreshed = await refreshCurrentUser();
      if (refreshed && isAccountAccessAllowed(refreshed)) {
        setStatusMsg('Email verification confirmed! Cloud sync unlocked.');
      } else {
        setStatusMsg('Still awaiting email verification.');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to refresh status.');
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    setBusy(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      await signOutAccount();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Sign-Out failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#1e1e1e] border border-neutral-200 dark:border-white/10 shadow-2xl overflow-hidden text-[#0d0d0d] dark:text-[#ececec]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-white/10 flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-semibold">
              Account & Studio Preferences
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Sync custom instructions, function tools, and typography across sessions.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[78vh] overflow-y-auto">
          {/* Account Card */}
          {user ? (
            <div className="space-y-2.5">
              <div className="p-4 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-[#252525] flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'User avatar'}
                      className="w-11 h-11 rounded-full object-cover border border-neutral-200 dark:border-white/15 shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d] flex items-center justify-center font-semibold text-sm shrink-0">
                      {initials}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-sm truncate">
                        {user.displayName || user.email?.split('@')[0] || 'Folio User'}
                      </span>
                      {userAllowed ? (
                        <span
                          title={userIsBluxli ? '@bluxli.me direct pass' : 'Email verified'}
                          className="inline-flex shrink-0"
                        >
                          <ShieldCheck className="w-4 h-4 text-emerald-500" />
                        </span>
                      ) : (
                        <span title="Email verification required" className="inline-flex shrink-0">
                          <ShieldAlert className="w-4 h-4 text-amber-500" />
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                      {user.email}
                      {userIsBluxli ? ' · bluxli.me direct' : ''}
                    </div>
                    <div className="text-[11px] font-mono text-neutral-400 truncate mt-0.5">
                      UID: {user.uid}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-white/15 text-xs font-medium hover:bg-neutral-200/60 dark:hover:bg-white/10 transition-colors shrink-0 disabled:opacity-50"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign out</span>
                </button>
              </div>

              {!userAllowed && (
                <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-700 dark:text-amber-200 space-y-2">
                  <div className="font-medium">
                    Email verification required for external domain ({user.email?.split('@')[1] || 'external'}).
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleResendVerification()}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-600 text-white hover:bg-amber-500 font-medium disabled:opacity-50"
                    >
                      <MailCheck className="w-3.5 h-3.5" />
                      <span>Resend Verification</span>
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleRefreshUser()}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-amber-500/40 hover:bg-amber-500/15 font-medium disabled:opacity-50"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>I&apos;ve Verified</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50/70 dark:bg-[#242424] space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">Sign in to Folio</div>
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    @bluxli.me passes directly with password · gmail.com, dawg.com, yahoo.com &amp; others require email verification.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleGoogleSignIn()}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d] text-xs font-semibold hover:opacity-90 transition-opacity shrink-0 disabled:opacity-50"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Google</span>
                </button>
              </div>

              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-neutral-200/70 dark:bg-[#1a1a1a] w-fit text-xs">
                <button
                  type="button"
                  onClick={() => setAuthMode('signin')}
                  className={`px-3 py-1 rounded-md font-medium transition-colors ${
                    authMode === 'signin'
                      ? 'bg-white dark:bg-[#2e2e2e] shadow-xs'
                      : 'text-neutral-500 dark:text-neutral-400'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('signup')}
                  className={`px-3 py-1 rounded-md font-medium transition-colors ${
                    authMode === 'signup'
                      ? 'bg-white dark:bg-[#2e2e2e] shadow-xs'
                      : 'text-neutral-500 dark:text-neutral-400'
                  }`}
                >
                  Create Account
                </button>
              </div>

              <form onSubmit={(e) => void handleEmailAuth(e)} className="space-y-2.5">
                {authMode === 'signup' && (
                  <input
                    type="text"
                    value={displayNameInput}
                    onChange={(e) => setDisplayNameInput(e.target.value)}
                    placeholder="Display name"
                    className="w-full h-9 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#1b1b1b] px-3 text-xs focus:outline-none focus:border-neutral-400"
                  />
                )}
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="Email (e.g. you@bluxli.me or name@gmail.com)"
                  className="w-full h-9 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#1b1b1b] px-3 text-xs focus:outline-none focus:border-neutral-400"
                />
                {emailInput.includes('@') && (
                  <div
                    className={`text-[11px] font-medium ${
                      inputIsBluxli
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {inputIsBluxli
                      ? 'bluxli.me recognized — password authentication only.'
                      : 'External domain — email verification required before cloud sync.'}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Password (min 6 characters)"
                    className="flex-1 h-9 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#1b1b1b] px-3 text-xs focus:outline-none focus:border-neutral-400"
                  />
                  <button
                    type="submit"
                    disabled={busy || !emailInput.trim() || passwordInput.length < 6}
                    className="px-4 h-9 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition-colors disabled:opacity-50 shrink-0"
                  >
                    {busy ? 'Working...' : authMode === 'signup' ? 'Register' : 'Sign In'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {statusMsg && (
            <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300">
              {statusMsg}
            </div>
          )}

          {errorMsg && (
            <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-300">
              {errorMsg}
            </div>
          )}

          {/* Typography / Font Theme */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700 dark:text-neutral-200">
              <Type className="w-3.5 h-3.5" />
              <span>Workspace Font Theme</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {FONT_PRESETS.map((preset) => {
                const active = preset.id === fontPreset;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onChangeFontPreset(preset.id)}
                    className={`p-3 rounded-xl border text-left transition-colors ${
                      active
                        ? 'border-[#0d0d0d] dark:border-white bg-neutral-100 dark:bg-white/10'
                        : 'border-neutral-200 dark:border-white/10 hover:bg-neutral-50 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="text-xs font-semibold"
                        style={{ fontFamily: preset.displayFamily }}
                      >
                        {preset.label}
                      </span>
                      {active && <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                    </div>
                    <div
                      className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 truncate"
                      style={{ fontFamily: preset.sansFamily }}
                    >
                      {preset.preview}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Immersive Pure Code Default */}
          <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-white/10 flex items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <Code2 className="w-4 h-4 mt-0.5 text-cyan-500 shrink-0" />
              <div>
                <div className="text-xs font-semibold">
                  Default Pure-Code Immersive Mode
                </div>
                <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Instructs new chats to respond directly in complete runnable code & live sandboxes.
                </div>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={defaultPureCode}
              onClick={() => onToggleDefaultPureCode(!defaultPureCode)}
              className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${
                defaultPureCode ? 'bg-cyan-500' : 'bg-neutral-300 dark:bg-neutral-700'
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  defaultPureCode ? 'left-5' : 'left-0.5'
                }`}
              />
            </button>
          </div>

          {/* Saved Sync Summary */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenInstructions();
              }}
              className="p-3 rounded-xl border border-neutral-200 dark:border-white/10 hover:bg-neutral-50 dark:hover:bg-white/5 text-left transition-colors"
            >
              <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-300">
                <FileText className="w-3.5 h-3.5" />
                <span>Saved Instructions</span>
              </div>
              <div className="text-lg font-display font-semibold mt-1 tabular-nums">
                {instructionsCount}
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenTools();
              }}
              className="p-3 rounded-xl border border-neutral-200 dark:border-white/10 hover:bg-neutral-50 dark:hover:bg-white/5 text-left transition-colors"
            >
              <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-300">
                <Wrench className="w-3.5 h-3.5" />
                <span>Custom Functions</span>
              </div>
              <div className="text-lg font-display font-semibold mt-1 tabular-nums">
                {toolsCount}
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
