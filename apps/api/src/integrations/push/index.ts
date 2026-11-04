import { type PushProvider } from './push.interface.js';
import { DevPushProvider, NoopPushProvider } from './dev-push.provider.js';
import { ExpoPushProvider } from './expo-push.provider.js';
import { env } from '../../config/env.js';

export * from './push.interface.js';
export * from './expo-push.provider.js';
export * from './dev-push.provider.js';

let pushProviderInstance: PushProvider | null = null;

export function getPushProvider(): PushProvider {
  if (!pushProviderInstance) {
    if (env.PUSH_PROVIDER === 'expo') {
      pushProviderInstance = new ExpoPushProvider();
    } else if (env.PUSH_PROVIDER === 'dev') {
      pushProviderInstance = new DevPushProvider();
    } else {
      pushProviderInstance = new NoopPushProvider();
    }
  }
  return pushProviderInstance;
}

