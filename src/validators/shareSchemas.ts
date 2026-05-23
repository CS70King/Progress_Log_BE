import { z } from 'zod';

export const shareProjectSchema = z.object({
  resource: z.literal('project')
});

export const shareTokenParamSchema = z.object({
  token: z.string().trim().min(8).max(128)
});

export const projectShareLinkParamSchema = z.object({
  projectId: z.string().uuid(),
  shareLinkId: z.string().uuid()
});

export const snapshotShareLinkParamSchema = z.object({
  snapshotId: z.string().uuid(),
  shareLinkId: z.string().uuid()
});
