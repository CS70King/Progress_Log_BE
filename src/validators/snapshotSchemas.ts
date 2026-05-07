import { z } from 'zod';

export const snapshotIdParamSchema = z.object({
  snapshotId: z.string().uuid()
});

export const createSnapshotSchema = z.object({
  title: z.string().min(1)
});
