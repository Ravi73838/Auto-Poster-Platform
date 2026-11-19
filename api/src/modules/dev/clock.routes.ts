import { Router } from 'express';
import { DevClockController } from './clock.controller.js';

export const devClockRouter = Router();

devClockRouter.get('/', DevClockController.getClock);
devClockRouter.post('/advance', DevClockController.advanceClock);
devClockRouter.post('/reset', DevClockController.resetClock);
devClockRouter.post('/run-due-jobs', DevClockController.runDueJobs);

