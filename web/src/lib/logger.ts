type LogLevel = 'info' | 'error' | 'warn' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  correlationId?: string;
  [key: string]: unknown;
}

const SENSITIVE_KEYS = [
  'aadhaar',
  'aadhaarNumber',
  'pan',
  'panNumber',
  'phone',
  'email',
  'accountNumber',
  'ifscCode',
  'password',
  'token',
  'otp',
];

function maskSensitiveData(obj: unknown, seen?: WeakSet<object>): unknown {
  if (!obj || typeof obj !== 'object') return obj;

  if (seen?.has(obj)) return '[Circular]';
  const seenSet = seen || new WeakSet<object>();
  seenSet.add(obj);

  if (Array.isArray(obj)) {
    return obj.map((item) => maskSensitiveData(item, seenSet));
  }

  const masked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s.toLowerCase()))) {
      if (typeof value === 'string') {
        masked[key] = value.length > 4 ? `****${value.slice(-4)}` : '****';
      } else {
        masked[key] = '****';
      }
    } else if (typeof value === 'object' && value !== null) {
      masked[key] = maskSensitiveData(value, seenSet);
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

function formatObject(obj: unknown): Record<string, unknown> | undefined {
  if (obj === undefined || obj === null) return undefined;

  if (obj instanceof Error) {
    return {
      error: {
        name: obj.name,
        message: obj.message,
        stack: obj.stack,
      },
    };
  }

  if (typeof obj === 'object') {
    return maskSensitiveData(obj) as Record<string, unknown>;
  }

  return { value: String(obj) };
}

function createLogEntry(
  level: LogLevel,
  message: string,
  context?: unknown,
  correlationId?: string
): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  if (correlationId) {
    entry.correlationId = correlationId;
  }

  const formatted = formatObject(context);
  if (formatted) {
    Object.assign(entry, formatted);
  }

  return entry;
}

function getCorrelationId(context?: unknown): string | undefined {
  if (context && typeof context === 'object' && 'correlationId' in context) {
    return (context as Record<string, unknown>).correlationId as string | undefined;
  }
  return undefined;
}

const LOG_LEVELS: Record<string, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const configuredLevel = (process.env.LOG_LEVEL || 'debug').toLowerCase();

function shouldLog(level: LogLevel): boolean {
  return (LOG_LEVELS[level] ?? 0) >= (LOG_LEVELS[configuredLevel] ?? 0);
}

export const logger = {
  info(message: string, context?: unknown): void {
    if (!shouldLog('info')) return;
    const correlationId = getCorrelationId(context);
    const entry = createLogEntry('info', message, context, correlationId);
    console.log(JSON.stringify(entry));
  },

  error(message: string, context?: unknown): void {
    if (!shouldLog('error')) return;
    const correlationId = getCorrelationId(context);
    const entry = createLogEntry('error', message, context, correlationId);
    console.error(JSON.stringify(entry));
  },

  warn(message: string, context?: unknown): void {
    if (!shouldLog('warn')) return;
    const correlationId = getCorrelationId(context);
    const entry = createLogEntry('warn', message, context, correlationId);
    console.warn(JSON.stringify(entry));
  },

  debug(message: string, context?: unknown): void {
    if (!shouldLog('debug')) return;
    const correlationId = getCorrelationId(context);
    const entry = createLogEntry('debug', message, context, correlationId);
    console.debug(JSON.stringify(entry));
  },
};
