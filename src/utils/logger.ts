/**
 * logger.ts
 * SwingSwang
 *
 * Structured logging for debug and performance monitoring.
 */

/** Log levels. */
export enum LogLevel {
  Debug = 'DEBUG',
  Info = 'INFO',
  Warn = 'WARN',
  Error = 'ERROR',
}

/** Structured log entry. */
export interface LogEntry {
  readonly level: LogLevel;
  readonly category: string;
  readonly message: string;
  readonly timestamp: number;
  readonly data?: Record<string, unknown>;
}

/** Whether debug logging is enabled. */
let debugEnabled = __DEV__;

/** Set debug logging on/off. */
export function setDebugLogging(enabled: boolean): void {
  debugEnabled = enabled;
}

/** Helper to redact full device local file URIs to avoid exposing local user paths in logs (Security S2). */
function sanitizeLogData(data?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!data) return undefined;
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string' && (value.startsWith('file://') || value.startsWith('ph://') || value.startsWith('content://'))) {
      const parts = value.split('/');
      const fileName = parts[parts.length - 1] || 'file';
      sanitized[key] = `[LOCAL_FILE].../${fileName}`;
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeLogData(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/** Core log function. */
function log(level: LogLevel, category: string, message: string, data?: Record<string, unknown>): void {
  if (level === LogLevel.Debug && !debugEnabled) return;

  const cleanData = sanitizeLogData(data);

  const entry: LogEntry = {
    level,
    category,
    message,
    timestamp: Date.now(),
    data: cleanData,
  };

  const prefix = `[${level}][${category}]`;

  switch (level) {
    case LogLevel.Debug:
      console.debug(prefix, message, cleanData ?? '');
      break;
    case LogLevel.Info:
      console.info(prefix, message, cleanData ?? '');
      break;
    case LogLevel.Warn:
      console.warn(prefix, message, cleanData ?? '');
      break;
    case LogLevel.Error:
      console.error(prefix, message, cleanData ?? '');
      break;
  }

  // Store for debug UI (ring buffer)
  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOG_BUFFER) {
    logBuffer.shift();
  }
}

/** Ring buffer for recent log entries. */
const logBuffer: LogEntry[] = [];
const MAX_LOG_BUFFER = 200;

/** Get recent log entries. */
export function getRecentLogs(): readonly LogEntry[] {
  return [...logBuffer];
}

/** Clear log buffer. */
export function clearLogs(): void {
  logBuffer.length = 0;
}

// ─── Category-specific loggers ──────────────────────────────────────

export const Logger = {
  video: {
    debug: (msg: string, data?: Record<string, unknown>) => log(LogLevel.Debug, 'VIDEO', msg, data),
    info: (msg: string, data?: Record<string, unknown>) => log(LogLevel.Info, 'VIDEO', msg, data),
    warn: (msg: string, data?: Record<string, unknown>) => log(LogLevel.Warn, 'VIDEO', msg, data),
    error: (msg: string, data?: Record<string, unknown>) => log(LogLevel.Error, 'VIDEO', msg, data),
  },
  pose: {
    debug: (msg: string, data?: Record<string, unknown>) => log(LogLevel.Debug, 'POSE', msg, data),
    info: (msg: string, data?: Record<string, unknown>) => log(LogLevel.Info, 'POSE', msg, data),
    warn: (msg: string, data?: Record<string, unknown>) => log(LogLevel.Warn, 'POSE', msg, data),
    error: (msg: string, data?: Record<string, unknown>) => log(LogLevel.Error, 'POSE', msg, data),
  },
  metrics: {
    debug: (msg: string, data?: Record<string, unknown>) => log(LogLevel.Debug, 'METRICS', msg, data),
    info: (msg: string, data?: Record<string, unknown>) => log(LogLevel.Info, 'METRICS', msg, data),
    warn: (msg: string, data?: Record<string, unknown>) => log(LogLevel.Warn, 'METRICS', msg, data),
    error: (msg: string, data?: Record<string, unknown>) => log(LogLevel.Error, 'METRICS', msg, data),
  },
  confidence: {
    debug: (msg: string, data?: Record<string, unknown>) => log(LogLevel.Debug, 'CONFIDENCE', msg, data),
    info: (msg: string, data?: Record<string, unknown>) => log(LogLevel.Info, 'CONFIDENCE', msg, data),
  },
  performance: {
    debug: (msg: string, data?: Record<string, unknown>) => log(LogLevel.Debug, 'PERF', msg, data),
    info: (msg: string, data?: Record<string, unknown>) => log(LogLevel.Info, 'PERF', msg, data),
  },
};

// ─── Performance Timer ──────────────────────────────────────────────

/** Simple wall-clock timer for measuring durations. */
export class PerformanceTimer {
  private readonly name: string;
  private readonly startTime: number;

  constructor(name: string) {
    this.name = name;
    this.startTime = performance.now();
  }

  /** Stop the timer and return elapsed milliseconds. Also logs the result. */
  stop(): number {
    const elapsed = performance.now() - this.startTime;
    Logger.performance.debug(`${this.name}: ${elapsed.toFixed(1)}ms`);
    return elapsed;
  }

  /** Get elapsed time without stopping. */
  elapsed(): number {
    return performance.now() - this.startTime;
  }
}
