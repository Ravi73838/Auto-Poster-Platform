import { ERROR_CODES } from '@ap/shared-constants';
import { AppError } from '../../shared/errors/app-error.js';
import type { ExampleRepository } from './repository.js';
import type { ExampleItem, CreateExampleDto } from './types.js';

export class ExampleService {
  constructor(private readonly repo: ExampleRepository) {}

  async getItem(id: string): Promise<ExampleItem> {
    const item = await this.repo.findById(id);
    if (!item) {
      throw new AppError(ERROR_CODES.NOT_FOUND, `Item with id ${id} not found`, 404);
    }
    return item;
  }

  async createItem(dto: CreateExampleDto): Promise<ExampleItem> {
    return this.repo.create(dto);
  }
}
