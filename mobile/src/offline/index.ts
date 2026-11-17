import { apiClient } from '../services/api';
import { UploadQueue } from './uploadQueue';

export * from './uploadQueue';
export const uploadQueue = new UploadQueue(apiClient);
