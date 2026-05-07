import { z } from 'zod';

export const shareProjectSchema = z.object({
  resource: z.literal('project')
});

export const shareTokenParamSchema = z.object({
  token: z.string().min(8)
});
