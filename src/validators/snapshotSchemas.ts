import { z } from 'zod';

export const snapshotIdParamSchema = z.object({
  snapshotId: z.string().uuid()
});

export const createSnapshotSchema = z.object({
  title: z.string().trim().min(1, 'Snapshot title is required').max(160, 'Snapshot title must be at most 160 characters')
});
