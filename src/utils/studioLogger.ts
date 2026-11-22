export type StudioLogSeverity = 'log' | 'warn' | 'error' | 'success';

export interface StudioLogEntry {
  id: string;
  timestamp: number;
  severity: StudioLogSeverity;
  source: string;
  message: string;
  details?: string;
}

const MAX_LOG_ENTRIES = 500;
const STORAGE_KEY = 'folio-studio-logs-v1';

class StudioLoggerBus {
  private entries: StudioLogEntry[] = [];
  private listeners = new Set<() => void>();

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as StudioLogEntry[];
          if (Array.isArray(parsed)) {
            this.entries = parsed.slice(-MAX_LOG_ENTRIES);
          }
        }
      } catch {
        // Ignore storage read error
      }
    }
  }

  private persistAndNotify() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries.slice(-200)));
      } catch {
        // Ignore storage write error
      }
    }
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch {
        // Ignore listener error
      }
    });
  }

  push(
    severity: StudioLogSeverity,
    source: string,
    message: string,
    details?: string
  ): StudioLogEntry {
    const entry: StudioLogEntry = {
      id:
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      severity,
      source: source || 'Studio',
      message: String(message || '').trim() || '(empty log)',
      details: details ? String(details).slice(0, 4000) : undefined,
    };
    this.entries = [...this.entries.slice(-(MAX_LOG_ENTRIES - 1)), entry];
    this.persistAndNotify();
    return entry;
  }

  log(source: string, message: string, details?: string) {
    return this.push('log', source, message, details);
  }

  warn(source: string, message: string, details?: string) {
    return this.push('warn', source, message, details);
  }

  error(source: string, message: string, details?: string) {
    return this.push('error', source, message, details);
  }

  success(source: string, message: string, details?: string) {
    return this.push('success', source, message, details);
  }

  clear() {
    this.entries = [];
    this.persistAndNotify();
  }

  getSnapshot(): StudioLogEntry[] {
    return this.entries;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const studioLogger = new StudioLoggerBus();
