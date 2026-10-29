import { pinoHttp } from 'pino-http';
import { logger } from '../logger/index.js';

export const requestLogger = pinoHttp({
  logger,
  customProps: (req) => ({
    requestId: req.id,
  }),
});
