type LogLevel = 'info' | 'error' | 'warn' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  correlationId?: string;
  [key: string]: unknown;
}

const SENSITIVE_KEYS = [
  'aadhaar', 'aadhaarNumber', 'pan', 'panNumber', 'phone', 'email', 
  'accountNumber', 'ifscCode', 'password', 'token', 'otp'
];

function maskSensitiveData(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(maskSensitiveData);
  }

  const masked: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.some(s => key.toLowerCase().includes(s.toLowerCase()))) {
      if (typeof value === 'string') {
        masked[key] = value.length > 4 ? `****${value.slice(-4)}` : '****';
      } else {
        masked[key] = '****';
      }
    } else if (typeof value === 'object') {
      masked[key] = maskSensitiveData(value);
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
    return maskSensitiveData(obj as Record<string, unknown>);
  }

  return undefined;
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

export const logger = {
  info(message: string, context?: unknown): LogEntry {
    const correlationId = getCorrelationId(context);
    const entry = createLogEntry('info', message, context, correlationId);
    console.log(JSON.stringify(entry));
    return entry;
  },

  error(message: string, context?: unknown): LogEntry {
    const correlationId = getCorrelationId(context);
    const entry = createLogEntry('error', message, context, correlationId);
    console.error(JSON.stringify(entry));
    return entry;
  },

  warn(message: string, context?: unknown): LogEntry {
    const correlationId = getCorrelationId(context);
    const entry = createLogEntry('warn', message, context, correlationId);
    console.warn(JSON.stringify(entry));
    return entry;
  },

  debug(message: string, context?: unknown): LogEntry {
    const correlationId = getCorrelationId(context);
    const entry = createLogEntry('debug', message, context, correlationId);
    console.debug(JSON.stringify(entry));
    return entry;
  },
};
