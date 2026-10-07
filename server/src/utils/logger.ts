const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'cookie',
  'apikey',
  'secret',
  'jwtsecret',
  'gemini_api_key',
  'openai_api_key',
  'grok_api_key',
  'jwt_access_secret',
  'jwt_refresh_secret',
]);

function redactSensitiveData(data: unknown, depth = 0): unknown {
  if (depth > 6) return '[MAX_DEPTH]';
  if (data === null || data === undefined) return data;

  if (typeof data === 'string') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item, depth + 1));
  }

  if (typeof data === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
      const lower = key.toLowerCase();
      const isSensitive = Array.from(SENSITIVE_KEYS).some(
        (sensitive) => lower.includes(sensitive) || sensitive.includes(lower)
      );

      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof val === 'object' && val !== null) {
        sanitized[key] = redactSensitiveData(val, depth + 1);
      } else {
        sanitized[key] = val;
      }
    }
    return sanitized;
  }

  return data;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogPayload {
  timestamp: string;
  level: LogLevel;
  message: string;
  meta?: Record<string, unknown>;
}

export const logger = {
  log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    const payload: LogPayload = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };

    if (meta && Object.keys(meta).length > 0) {
      payload.meta = redactSensitiveData(meta) as Record<string, unknown>;
    }

    const output = JSON.stringify(payload);

    switch (level) {
      case 'error':
        console.error(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'debug':
        if (process.env.NODE_ENV !== 'production') {
          console.debug(output);
        }
        break;
      case 'info':
      default:
        console.log(output);
        break;
    }
  },

  info(message: string, meta?: Record<string, unknown>): void {
    this.log('info', message, meta);
  },

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log('warn', message, meta);
  },

  error(message: string, meta?: Record<string, unknown>): void {
    this.log('error', message, meta);
  },

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log('debug', message, meta);
  },
};
