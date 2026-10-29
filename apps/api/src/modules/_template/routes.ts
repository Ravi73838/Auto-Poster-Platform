import { Router } from 'express';
import { ExampleRepository } from './repository.js';
import { ExampleService } from './service.js';
import { ExampleController } from './controller.js';

export function createExampleRouter(): Router {
  const router = Router();
  const repo = new ExampleRepository();
  const service = new ExampleService(repo);
  const controller = new ExampleController(service);

  router.get('/:id', controller.getItem);
  router.post('/', controller.createItem);

  return router;
}
