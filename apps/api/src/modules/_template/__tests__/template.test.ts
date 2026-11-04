import { describe, it, expect } from 'vitest';
import { ExampleRepository } from '../repository.js';
import { ExampleService } from '../service.js';
import { AppError } from '../../../shared/errors/app-error.js';

describe('Module Template: ExampleService', () => {
  it('creates and retrieves an item', async () => {
    const repo = new ExampleRepository();
    const service = new ExampleService(repo);

    const created = await service.createItem({ name: 'Test Poster' });
    expect(created.name).toBe('Test Poster');

    const fetched = await service.getItem(created.id);
    expect(fetched.id).toBe(created.id);
  });

  it('throws AppError 404 for missing item', async () => {
    const repo = new ExampleRepository();
    const service = new ExampleService(repo);

    await expect(service.getItem('nonexistent')).rejects.toThrow(AppError);
  });
});

