export const cacheKeys = {
  shareLookup: (token: string) => `share:lookup:${token}`,
  dossierProjectPayload: (projectId: string) => `dossier:project:${projectId}:payload`,
  dossierSnapshotBase: (snapshotId: string) => `dossier:snapshot:${snapshotId}:base`
};
