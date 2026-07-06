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

/** Core log function. */
function log(level: LogLevel, category: string, message: string, data?: Record<string, unknown>): void {
  if (level === LogLevel.Debug && !debugEnabled) return;

  const entry: LogEntry = {
    level,
    category,
    message,
    timestamp: Date.now(),
    data,
  };

  const prefix = `[${level}][${category}]`;

  switch (level) {
    case LogLevel.Debug:
      console.debug(prefix, message, data ?? '');
      break;
    case LogLevel.Info:
      console.info(prefix, message, data ?? '');
      break;
    case LogLevel.Warn:
      console.warn(prefix, message, data ?? '');
      break;
    case LogLevel.Error:
      console.error(prefix, message, data ?? '');
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
