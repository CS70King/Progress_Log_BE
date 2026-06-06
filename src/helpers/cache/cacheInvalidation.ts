import { logger } from '../../utils/logger';
import { cacheKeys } from './cacheKeys';
import { cacheStore } from './cacheStore';

export const cacheInvalidation = {
  async invalidateProjectDossier(projectId: string) {
    await cacheStore.delete(cacheKeys.dossierProjectPayload(projectId));
    logger.debug('cache.invalidate.project_dossier', {
      projectId
    });
  },

  async invalidateSnapshotDossier(snapshotId: string) {
    await cacheStore.delete(cacheKeys.dossierSnapshotBase(snapshotId));
    logger.debug('cache.invalidate.snapshot_dossier', {
      snapshotId
    });
  },

  async invalidateShareLookup(token: string) {
    await cacheStore.delete(cacheKeys.shareLookup(token));
    logger.debug('cache.invalidate.share_lookup', {
      tokenPrefix: token.slice(0, 8)
    });
  }
};
