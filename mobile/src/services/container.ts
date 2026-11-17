import type { AppAdapters } from './adapters/types';

let currentAdapters: AppAdapters | null = null;

function getAdapters(): AppAdapters {
  if (!currentAdapters) {
    try {
      // Dynamic import to prevent eager native module evaluation in Node
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createProductionAdapters } = require('./adapters/production');
      currentAdapters = createProductionAdapters();
    } catch {
      // Headless Node environment fallback to in-memory fakes
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createFakeAdapters } = require('./adapters/fakes');
      currentAdapters = createFakeAdapters();
    }
  }
  return currentAdapters!;
}

export const container = {
  get storage() {
    return getAdapters().storage;
  },
  get secureStore() {
    return getAdapters().secureStore;
  },
  get network() {
    return getAdapters().network;
  },
  get clock() {
    return getAdapters().clock;
  },
  get location() {
    return getAdapters().location;
  },
  get camera() {
    return getAdapters().camera;
  },
  get deviceInfo() {
    return getAdapters().deviceInfo;
  },
  get fileStore() {
    return getAdapters().fileStore;
  },
  get notifier() {
    return getAdapters().notifier;
  },
};

/**
 * Injects custom adapters (e.g. in-memory test fakes for tests and the simulator).
 */
export function setContainerAdapters(adapters: AppAdapters): void {
  currentAdapters = adapters;
}

/**
 * Resets container to standard production adapters.
 */
export function resetContainerAdapters(): void {
  currentAdapters = null;
}
