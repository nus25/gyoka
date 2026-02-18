export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogRecord = Record<string, unknown>;

type LoggerOptions = {
  service?: string;
  minLevel?: LogLevel;
  includeTimestamp?: boolean;
  includeService?: boolean;
};

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

// possibly extendable in the future if we want to support different log formats or outputs
const REDACTED_KEYS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x_auth_token',
  'token',
  'password',
  'secret',
]);

const maskValue = '[REDACTED]';

function shouldLog(level: LogLevel, minLevel: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[minLevel];
}

function normalizeValue(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeValue(entry));
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(record).map(([key, entry]) => {
        if (REDACTED_KEYS.has(key.toLowerCase())) {
          return [key, maskValue];
        }
        return [key, normalizeValue(entry)];
      })
    );
  }

  return value;
}

function writeLog(level: LogLevel, payload: LogRecord): void {
  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(line);
    return;
  }
  if (level === 'warn') {
    console.warn(line);
    return;
  }
  console.log(line);
}

export function createLogger(options: LoggerOptions) {
  const minLevel = options.minLevel ?? 'info';
  const includeTimestamp = options.includeTimestamp ?? false;
  const includeService = options.includeService ?? false;

  const log = (level: LogLevel, event: string, details?: Record<string, unknown>) => {
    if (!shouldLog(level, minLevel)) {
      return;
    }

    const payload: LogRecord = {
      level,
      event,
      ...(details ? (normalizeValue(details) as Record<string, unknown>) : {}),
    };

    if (includeService && options.service) {
      payload.service = options.service;
    }

    if (includeTimestamp) {
      payload.timestamp = new Date().toISOString();
    }

    writeLog(level, payload);
  };

  return {
    debug: (event: string, details?: Record<string, unknown>) => log('debug', event, details),
    info: (event: string, details?: Record<string, unknown>) => log('info', event, details),
    warn: (event: string, details?: Record<string, unknown>) => log('warn', event, details),
    error: (event: string, details?: Record<string, unknown>) => log('error', event, details),
  };
}
