import type { Request, Response, NextFunction } from 'express';
import type { ApiSuccessResponse } from '@ap/shared-types';
import type { ExampleService } from './service.js';
import { createExampleSchema } from './validation.js';
import type { ExampleItem } from './types.js';

export class ExampleController {
  constructor(private readonly service: ExampleService) {}

  getItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const item = await this.service.getItem(String(id));
      const response: ApiSuccessResponse<ExampleItem> = {
        success: true,
        data: item,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  };

  createItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = createExampleSchema.parse(req.body);
      const created = await this.service.createItem(validated);
      const response: ApiSuccessResponse<ExampleItem> = {
        success: true,
        data: created,
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  };
}

