import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

const pinoInstance = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
        },
      }
    : undefined,
  base: {
    env: process.env.NODE_ENV,
  },
});

// Create a wrapper that is API-compatible with console.log / console.error
export const logger = {
  info: (message?: any, ...optionalParams: any[]) => {
    if (optionalParams.length > 0) {
      pinoInstance.info({ params: optionalParams }, typeof message === 'string' ? message : String(message));
    } else {
      pinoInstance.info(message);
    }
  },
  warn: (message?: any, ...optionalParams: any[]) => {
    if (optionalParams.length > 0) {
      pinoInstance.warn({ params: optionalParams }, typeof message === 'string' ? message : String(message));
    } else {
      pinoInstance.warn(message);
    }
  },
  error: (message?: any, ...optionalParams: any[]) => {
    if (optionalParams.length > 0) {
      pinoInstance.error({ params: optionalParams }, typeof message === 'string' ? message : String(message));
    } else {
      pinoInstance.error(message);
    }
  },
};
