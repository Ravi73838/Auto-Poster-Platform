import { type Request, type Response } from 'express';
import {
  createCitySchema,
  updateCitySchema,
  createZoneSchema,
  updateZoneSchema,
  idParamSchema,
} from '@ap/shared-validation';
import { LocationsService } from './locations.service.js';

export class LocationsController {
  static async listCities(req: Request, res: Response): Promise<void> {
    const data = await LocationsService.listActiveCities();
    res.status(200).json({ success: true, data });
  }

  static async listZones(req: Request, res: Response): Promise<void> {
    const { id } = idParamSchema.parse(req.params);
    const data = await LocationsService.listZonesForCity(id);
    res.status(200).json({ success: true, data });
  }

  static async getLegalVersions(req: Request, res: Response): Promise<void> {
    const data = await LocationsService.getLegalVersions();
    res.status(200).json({ success: true, data });
  }

  // --- Admin Endpoints ---

  static async adminListCities(req: Request, res: Response): Promise<void> {
    const data = await LocationsService.listAllCitiesAdmin();
    res.status(200).json({ success: true, data });
  }

  static async adminCreateCity(req: Request, res: Response): Promise<void> {
    const input = createCitySchema.parse(req.body);
    const data = await LocationsService.createCity(input);
    res.status(201).json({ success: true, data });
  }

  static async adminUpdateCity(req: Request, res: Response): Promise<void> {
    const { id } = idParamSchema.parse(req.params);
    const input = updateCitySchema.parse(req.body);
    const data = await LocationsService.updateCity(id, input);
    res.status(200).json({ success: true, data });
  }

  static async adminListZones(req: Request, res: Response): Promise<void> {
    const cityId = typeof req.query.cityId === 'string' ? req.query.cityId : undefined;
    const data = await LocationsService.listAllZonesAdmin(cityId);
    res.status(200).json({ success: true, data });
  }

  static async adminCreateZone(req: Request, res: Response): Promise<void> {
    const input = createZoneSchema.parse(req.body);
    const data = await LocationsService.createZone(input);
    res.status(201).json({ success: true, data });
  }

  static async adminUpdateZone(req: Request, res: Response): Promise<void> {
    const { id } = idParamSchema.parse(req.params);
    const input = updateZoneSchema.parse(req.body);
    const data = await LocationsService.updateZone(id, input);
    res.status(200).json({ success: true, data });
  }
}

