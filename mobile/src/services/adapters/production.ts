/* eslint-disable @typescript-eslint/no-require-imports */
import type {
  IStorage,
  ISecureStore,
  INetwork,
  IClock,
  ILocationProvider,
  ICameraProvider,
  IDeviceInfoProvider,
  IFileStore,
  INotifier,
  LocationResult,
  PhotoCaptureResult,
  DeviceInfoResult,
  AppAdapters,
} from './types';
import { Platform } from 'react-native';

// Fallback memory storage for environments without native modules
const memoryStorage = new Map<string, string>();
const memorySecureStorage = new Map<string, string>();

export class ProductionStorage implements IStorage {
  async getItem(key: string): Promise<string | null> {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      return await AsyncStorage.getItem(key);
    } catch {
      return memoryStorage.get(key) ?? null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.setItem(key, value);
    } catch {
      memoryStorage.set(key, value);
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.removeItem(key);
    } catch {
      memoryStorage.delete(key);
    }
  }

  async getAllKeys(): Promise<string[]> {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      return await AsyncStorage.getAllKeys();
    } catch {
      return Array.from(memoryStorage.keys());
    }
  }
}

export class ProductionSecureStore implements ISecureStore {
  async getItem(key: string): Promise<string | null> {
    try {
      const SecureStore = require('expo-secure-store');
      if (await SecureStore.isAvailableAsync()) {
        return await SecureStore.getItemAsync(key);
      }
    } catch {
      // fallback
    }
    return memorySecureStorage.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      const SecureStore = require('expo-secure-store');
      if (await SecureStore.isAvailableAsync()) {
        await SecureStore.setItemAsync(key, value, {
          keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
        });
        return;
      }
    } catch {
      // fallback
    }
    memorySecureStorage.set(key, value);
  }

  async deleteItem(key: string): Promise<void> {
    try {
      const SecureStore = require('expo-secure-store');
      if (await SecureStore.isAvailableAsync()) {
        await SecureStore.deleteItemAsync(key);
        return;
      }
    } catch {
      // fallback
    }
    memorySecureStorage.delete(key);
  }
}

export class ProductionNetwork implements INetwork {
  async isConnected(): Promise<boolean> {
    try {
      const NetInfo = require('@react-native-community/netinfo').default;
      const state = await NetInfo.fetch();
      return Boolean(state.isConnected && state.isInternetReachable !== false);
    } catch {
      return true;
    }
  }

  subscribe(listener: (connected: boolean) => void): () => void {
    try {
      const NetInfo = require('@react-native-community/netinfo').default;
      return NetInfo.addEventListener((state: any) => {
        listener(Boolean(state.isConnected && state.isInternetReachable !== false));
      });
    } catch {
      return () => {};
    }
  }
}

export class ProductionClock implements IClock {
  now(): Date {
    return new Date();
  }

  nowIso(): string {
    return new Date().toISOString();
  }

  nowTimestamp(): number {
    return Date.now();
  }
}

export class ProductionLocationProvider implements ILocationProvider {
  async getCurrentLocation(): Promise<LocationResult> {
    const Location = require('expo-location');
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Highest,
    });
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy ?? 10,
      isMock: Boolean(position.mocked),
      timestamp: position.timestamp,
    };
  }
}

export class ProductionCameraProvider implements ICameraProvider {
  async takePhoto(): Promise<PhotoCaptureResult> {
    throw new Error('Direct camera invocation must be performed via CameraView component in UI');
  }
}

export class ProductionDeviceInfoProvider implements IDeviceInfoProvider {
  constructor(private secureStore?: ISecureStore) {}

  async getDeviceInfo(): Promise<DeviceInfoResult> {
    const Device = require('expo-device');
    const Application = require('expo-application');

    let installId: string | null = null;
    if (this.secureStore) {
      installId = await this.secureStore.getItem('ap_device_install_id');
      if (!installId) {
        installId = `inst_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        await this.secureStore.setItem('ap_device_install_id', installId);
      }
    } else {
      installId = memorySecureStorage.get('ap_device_install_id') ?? null;
      if (!installId) {
        installId = `inst_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        memorySecureStorage.set('ap_device_install_id', installId);
      }
    }

    return {
      model: Device.modelName || 'Unknown Android Device',
      osVersion: `${Platform.OS} ${Platform.Version}`,
      appVersion: Application.nativeApplicationVersion || '0.1.0',
      installId,
    };
  }
}

export class ProductionFileStore implements IFileStore {
  async saveFile(sourceUri: string, destName: string): Promise<string> {
    const FileSystem = require('expo-file-system');
    const destPath = `${FileSystem.documentDirectory}queue_${destName}`;
    await FileSystem.copyAsync({ from: sourceUri, to: destPath });
    return destPath;
  }

  async deleteFile(path: string): Promise<void> {
    const FileSystem = require('expo-file-system');
    try {
      await FileSystem.deleteAsync(path, { idempotent: true });
    } catch {
      // ignore
    }
  }

  async exists(path: string): Promise<boolean> {
    const FileSystem = require('expo-file-system');
    try {
      const info = await FileSystem.getInfoAsync(path);
      return info.exists;
    } catch {
      return false;
    }
  }

  async getFreeDiskSpace(): Promise<number> {
    const FileSystem = require('expo-file-system');
    try {
      return await FileSystem.getFreeDiskStorageAsync();
    } catch {
      return 1024 * 1024 * 500; // 500MB fallback
    }
  }
}

export class ProductionNotifier implements INotifier {
  async registerForPushNotifications(): Promise<string | null> {
    try {
      const Notifications = require('expo-notifications');
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return null;

      const tokenData = await Notifications.getExpoPushTokenAsync();
      return tokenData.data;
    } catch {
      return null;
    }
  }

  async unregister(): Promise<void> {
    // Unregister token with server is handled by API endpoint
  }
}

export function createProductionAdapters(): AppAdapters {
  const secureStore = new ProductionSecureStore();
  return {
    storage: new ProductionStorage(),
    secureStore,
    network: new ProductionNetwork(),
    clock: new ProductionClock(),
    location: new ProductionLocationProvider(),
    camera: new ProductionCameraProvider(),
    deviceInfo: new ProductionDeviceInfoProvider(secureStore),
    fileStore: new ProductionFileStore(),
    notifier: new ProductionNotifier(),
  };
}
