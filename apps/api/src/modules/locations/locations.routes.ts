import { Router } from 'express';
import { LocationsController } from './locations.controller.js';

export const locationsRouter = Router();

locationsRouter.get('/cities', LocationsController.listCities);
locationsRouter.get('/cities/:id/zones', LocationsController.listZones);

export const legalRouter = Router();
legalRouter.get('/versions', LocationsController.getLegalVersions);

