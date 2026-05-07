import { StorageProvider } from './types';

export const mockStorage: StorageProvider = {
  async uploadEvidenceFile() {
    return;
  },

  async deleteEvidenceFile() {
    return;
  },

  async signEvidenceUrl(_bucket, filePath, ttlSeconds) {
    return {
      url: `https://mock-storage.local/${encodeURIComponent(filePath)}`,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString()
    };
  }
};
