import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { requestIdMiddleware } from './shared/middleware/request-id.js';
import { requestLogger } from './shared/middleware/request-logger.js';
import { rateLimiter } from './shared/middleware/rate-limiter.js';
import { languageMiddleware } from './shared/middleware/language.js';
import { authenticate, blockSuspendedWrites } from './shared/middleware/auth.js';
import { maintenanceModeGuard } from './shared/middleware/maintenance-mode.js';
import { notFoundHandler } from './shared/middleware/not-found.js';
import { errorHandler } from './shared/middleware/error-handler.js';
import { createApiRouter } from './routes.js';
import { registerCampaignEventListeners } from './events/listeners/campaign.listeners.js';
import { registerFinanceEventListeners } from './events/listeners/finance.listeners.js';
import { registerDisciplineEventListeners } from './events/listeners/discipline.listeners.js';

export function createApp(): Express {
  registerCampaignEventListeners();
  registerFinanceEventListeners();
  registerDisciplineEventListeners();

  const app = express();

  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || env.corsOriginsList.includes(origin) || env.NODE_ENV === 'development') {
          callback(null, true);
        } else {
          callback(new Error('Blocked by CORS'));
        }
      },
      credentials: true,
    }),
  );

  app.use(cookieParser());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.use(requestIdMiddleware);
  app.use(requestLogger);
  app.use(rateLimiter);
  app.use(languageMiddleware);
  app.use(authenticate);
  app.use(blockSuspendedWrites());
  app.use(maintenanceModeGuard());

  app.use('/api/v1', createApiRouter());

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

