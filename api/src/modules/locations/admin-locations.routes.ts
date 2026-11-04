import { Router } from 'express';
import { LocationsController } from './locations.controller.js';
import {
  authenticate,
  requireAuth,
  requirePermission,
} from '../../shared/middleware/auth.js';

export const adminLocationsRouter = Router();

adminLocationsRouter.use(
  authenticate,
  requireAuth,
  requirePermission('location.manage'),
);

adminLocationsRouter.get('/cities', LocationsController.adminListCities);
adminLocationsRouter.post('/cities', LocationsController.adminCreateCity);
adminLocationsRouter.put('/cities/:id', LocationsController.adminUpdateCity);

adminLocationsRouter.get('/zones', LocationsController.adminListZones);
adminLocationsRouter.post('/zones', LocationsController.adminCreateZone);
adminLocationsRouter.put('/zones/:id', LocationsController.adminUpdateZone);

