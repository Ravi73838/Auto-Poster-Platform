import { EventEmitter } from 'node:events';
import { logger } from '../shared/logger/index.js';
import type { AppEvents } from './types.js';

class TypedEventBus {
  private emitter = new EventEmitter();

  emit<K extends keyof AppEvents>(event: K, payload: AppEvents[K]): boolean {
    logger.info({ event, payload }, `Event emitted: ${event}`);
    return this.emitter.emit(event, payload);
  }

  on<K extends keyof AppEvents>(
    event: K,
    listener: (payload: AppEvents[K]) => void | Promise<void>,
  ): this {
    this.emitter.on(event, async (payload) => {
      try {
        await listener(payload);
      } catch (err) {
        logger.error({ err, event, payload }, `Error in event listener for ${event}`);
      }
    });
    return this;
  }

  removeAllListeners(): this {
    this.emitter.removeAllListeners();
    return this;
  }
}

export const eventBus = new TypedEventBus();

export function emitEvent<K extends keyof AppEvents>(
  event: K,
  payload: AppEvents[K],
): boolean {
  return eventBus.emit(event, payload);
}

export * from './types.js';
