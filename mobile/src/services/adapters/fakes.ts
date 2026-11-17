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

export class FakeStorage implements IStorage {
  private map = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.map.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.map.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.map.delete(key);
  }

  async getAllKeys(): Promise<string[]> {
    return Array.from(this.map.keys());
  }

  async clear(): Promise<void> {
    this.map.clear();
  }

  // Inspection helper
  dump(): Record<string, string> {
    return Object.fromEntries(this.map.entries());
  }
}

export class FakeSecureStore implements ISecureStore {
  private store = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async deleteItem(key: string): Promise<void> {
    this.store.delete(key);
  }
}

export class FakeNetwork implements INetwork {
  private connected = true;
  private listeners = new Set<(connected: boolean) => void>();

  async isConnected(): Promise<boolean> {
    return this.connected;
  }

  setConnected(status: boolean): void {
    if (this.connected !== status) {
      this.connected = status;
      this.listeners.forEach((listener) => listener(status));
    }
  }

  subscribe(listener: (connected: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export class FakeClock implements IClock {
  private currentTime: Date;

  constructor(initialTime?: Date | string | number) {
    this.currentTime = initialTime ? new Date(initialTime) : new Date('2026-11-17T10:00:00+05:30');
  }

  now(): Date {
    return new Date(this.currentTime.getTime());
  }

  nowIso(): string {
    return this.currentTime.toISOString();
  }

  nowTimestamp(): number {
    return this.currentTime.getTime();
  }

  setTime(date: Date | string | number): void {
    this.currentTime = new Date(date);
  }

  advanceHours(hours: number): void {
    this.currentTime = new Date(this.currentTime.getTime() + hours * 3600 * 1000);
  }

  advanceDays(days: number): void {
    this.currentTime = new Date(this.currentTime.getTime() + days * 86400 * 1000);
  }

  advanceMinutes(mins: number): void {
    this.currentTime = new Date(this.currentTime.getTime() + mins * 60 * 1000);
  }

  advanceSeconds(secs: number): void {
    this.currentTime = new Date(this.currentTime.getTime() + secs * 1000);
  }
}

export class FakeLocationProvider implements ILocationProvider {
  private currentLocation: LocationResult = {
    latitude: 23.0225, // Ahmedabad default
    longitude: 72.5714,
    accuracy: 8.5, // 8.5 meters fine GPS
    isMock: false,
    timestamp: Date.now(),
  };

  setLocation(loc: Partial<LocationResult>): void {
    this.currentLocation = {
      ...this.currentLocation,
      ...loc,
      timestamp: loc.timestamp || Date.now(),
    };
  }

  async getCurrentLocation(): Promise<LocationResult> {
    return { ...this.currentLocation };
  }
}

export class FakeCameraProvider implements ICameraProvider {
  private lastCaptured: PhotoCaptureResult = {
    uri: 'file:///data/user/0/in.autoposter.driver/cache/photo_mock.jpg',
    width: 1920,
    height: 1080,
    fileSize: 245000,
  };

  setMockCapture(capture: Partial<PhotoCaptureResult>): void {
    this.lastCaptured = { ...this.lastCaptured, ...capture };
  }

  async takePhoto(): Promise<PhotoCaptureResult> {
    return { ...this.lastCaptured };
  }
}

export class FakeDeviceInfoProvider implements IDeviceInfoProvider {
  private info: DeviceInfoResult = {
    model: 'Simulated AutoPhone A1',
    osVersion: 'Android 14',
    appVersion: '0.1.0',
    installId: 'fake-install-id-001',
  };

  setDeviceInfo(partial: Partial<DeviceInfoResult>): void {
    this.info = { ...this.info, ...partial };
  }

  async getDeviceInfo(): Promise<DeviceInfoResult> {
    return { ...this.info };
  }
}

export class FakeFileStore implements IFileStore {
  private files = new Map<string, { size: number; content: string }>();
  private freeSpaceBytes = 1024 * 1024 * 1024; // 1GB default free

  setFreeSpace(bytes: number): void {
    this.freeSpaceBytes = bytes;
  }

  async saveFile(sourceUri: string, destName: string): Promise<string> {
    const destPath = `file:///virtual_fs/${destName}`;
    this.files.set(destPath, { size: 250000, content: `data_from_${sourceUri}` });
    return destPath;
  }

  async deleteFile(path: string): Promise<void> {
    this.files.delete(path);
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path);
  }

  async getFreeDiskSpace(): Promise<number> {
    return this.freeSpaceBytes;
  }
}

export class FakeNotifier implements INotifier {
  private token: string | null = 'fake-fcm-token-12345';
  private unregisterCalled = false;

  async registerForPushNotifications(): Promise<string | null> {
    return this.token;
  }

  async unregister(): Promise<void> {
    this.unregisterCalled = true;
    this.token = null;
  }

  isUnregistered(): boolean {
    return this.unregisterCalled;
  }
}

/**
 * Creates a complete suite of isolated in-memory fakes.
 */
export function createFakeAdapters(): AppAdapters & {
  fakeStorage: FakeStorage;
  fakeSecureStore: FakeSecureStore;
  fakeNetwork: FakeNetwork;
  fakeClock: FakeClock;
  fakeLocation: FakeLocationProvider;
  fakeCamera: FakeCameraProvider;
  fakeDeviceInfo: FakeDeviceInfoProvider;
  fakeFileStore: FakeFileStore;
  fakeNotifier: FakeNotifier;
} {
  const fakeStorage = new FakeStorage();
  const fakeSecureStore = new FakeSecureStore();
  const fakeNetwork = new FakeNetwork();
  const fakeClock = new FakeClock();
  const fakeLocation = new FakeLocationProvider();
  const fakeCamera = new FakeCameraProvider();
  const fakeDeviceInfo = new FakeDeviceInfoProvider();
  const fakeFileStore = new FakeFileStore();
  const fakeNotifier = new FakeNotifier();

  return {
    storage: fakeStorage,
    secureStore: fakeSecureStore,
    network: fakeNetwork,
    clock: fakeClock,
    location: fakeLocation,
    camera: fakeCamera,
    deviceInfo: fakeDeviceInfo,
    fileStore: fakeFileStore,
    notifier: fakeNotifier,
    // Direct access to control fakes in tests
    fakeStorage,
    fakeSecureStore,
    fakeNetwork,
    fakeClock,
    fakeLocation,
    fakeCamera,
    fakeDeviceInfo,
    fakeFileStore,
    fakeNotifier,
  };
}
