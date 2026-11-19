import { FlowCreditState, FlowCreditTransaction } from '../types/flow';

export const FLOW_DAILY_CREDIT_LIMIT = 50;
const FLOW_CREDITS_STORAGE_KEY = 'folio-google-flow-credits-v1';

export const FLOW_CREDIT_COSTS = {
  imageFrame: 2,
  videoFast720: 5,
  videoQuality1080: 10,
  extendShot: 5,
  editShot: 5,
  musicScore: 3,
} as const;

export function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getMillisecondsUntilMidnight(now = new Date()): number {
  const nextMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0,
    0
  );
  return Math.max(0, nextMidnight.getTime() - now.getTime());
}

export function formatMidnightCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [
    String(hours).padStart(2, '0'),
    String(minutes).padStart(2, '0'),
    String(seconds).padStart(2, '0'),
  ].join(':');
}

export function createFreshCreditState(dateKey = getLocalDateKey()): FlowCreditState {
  return {
    balance: FLOW_DAILY_CREDIT_LIMIT,
    dailyLimit: FLOW_DAILY_CREDIT_LIMIT,
    lastResetDate: dateKey,
    transactions: [],
  };
}

export function reconcileCreditState(state: FlowCreditState): FlowCreditState {
  const today = getLocalDateKey();
  if (state.lastResetDate !== today) {
    return createFreshCreditState(today);
  }
  return {
    balance: Math.min(FLOW_DAILY_CREDIT_LIMIT, Math.max(0, state.balance)),
    dailyLimit: FLOW_DAILY_CREDIT_LIMIT,
    lastResetDate: today,
    transactions: Array.isArray(state.transactions) ? state.transactions.slice(0, 30) : [],
  };
}

export function loadCreditState(): FlowCreditState {
  try {
    const raw = localStorage.getItem(FLOW_CREDITS_STORAGE_KEY);
    if (!raw) return createFreshCreditState();
    const parsed = JSON.parse(raw) as Partial<FlowCreditState>;
    const initial: FlowCreditState = {
      balance:
        typeof parsed.balance === 'number'
          ? parsed.balance
          : FLOW_DAILY_CREDIT_LIMIT,
      dailyLimit: FLOW_DAILY_CREDIT_LIMIT,
      lastResetDate:
        typeof parsed.lastResetDate === 'string'
          ? parsed.lastResetDate
          : getLocalDateKey(),
      transactions: Array.isArray(parsed.transactions)
        ? (parsed.transactions as FlowCreditTransaction[])
        : [],
    };
    return reconcileCreditState(initial);
  } catch {
    return createFreshCreditState();
  }
}

export function saveCreditState(state: FlowCreditState): void {
  try {
    localStorage.setItem(FLOW_CREDITS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}

export function getVideoCreditCost(
  resolution: '360p' | '720p' | '1080p',
  qualityTier: 'fast' | 'quality'
): number {
  if (resolution === '1080p' || qualityTier === 'quality') {
    return FLOW_CREDIT_COSTS.videoQuality1080;
  }
  return FLOW_CREDIT_COSTS.videoFast720;
}
