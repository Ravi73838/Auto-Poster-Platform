/**
 * Ports & Adapters Architecture Interfaces for Mobile App.
 * These interfaces decouple core logic, offline queue, and capture services
 * from native platform modules (Expo / React Native).
 */

export interface IStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  getAllKeys(): Promise<string[]>;
  clear?(): Promise<void>;
}

export interface ISecureStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem(key: string): Promise<void>;
}

export interface INetwork {
  isConnected(): Promise<boolean>;
  subscribe(listener: (connected: boolean) => void): () => void;
}

export interface IClock {
  now(): Date;
  nowIso(): string;
  nowTimestamp(): number;
}

export interface LocationResult {
  latitude: number;
  longitude: number;
  accuracy: number;
  isMock: boolean;
  timestamp: number;
}

export interface ILocationProvider {
  getCurrentLocation(): Promise<LocationResult>;
}

export interface PhotoCaptureResult {
  uri: string;
  width: number;
  height: number;
  fileSize: number;
}

export interface ICameraProvider {
  takePhoto(options?: { quality?: number }): Promise<PhotoCaptureResult>;
}

export interface DeviceInfoResult {
  model: string;
  osVersion: string;
  appVersion: string;
  installId: string;
}

export interface IDeviceInfoProvider {
  getDeviceInfo(): Promise<DeviceInfoResult>;
}

export interface IFileStore {
  saveFile(sourceUri: string, destName: string): Promise<string>;
  deleteFile(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  getFreeDiskSpace(): Promise<number>; // In bytes
}

export interface INotifier {
  registerForPushNotifications(): Promise<string | null>;
  unregister(): Promise<void>;
}

export interface AppAdapters {
  storage: IStorage;
  secureStore: ISecureStore;
  network: INetwork;
  clock: IClock;
  location: ILocationProvider;
  camera: ICameraProvider;
  deviceInfo: IDeviceInfoProvider;
  fileStore: IFileStore;
  notifier: INotifier;
}
