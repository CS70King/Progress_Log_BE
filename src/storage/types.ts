export type SignedUrlResult = {
  url: string;
  expiresAt: string;
};

export type StorageProvider = {
  uploadEvidenceFile: (bucket: string, filePath: string, body: Buffer, contentType: string) => Promise<void>;
  deleteEvidenceFile: (bucket: string, filePath: string) => Promise<void>;
  signEvidenceUrl: (bucket: string, filePath: string, ttlSeconds: number) => Promise<SignedUrlResult>;
};
