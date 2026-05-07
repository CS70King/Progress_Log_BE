import { z } from 'zod';

export const evidenceIdParamSchema = z.object({
  evidenceId: z.string().uuid()
});

export const evidenceUploadSchema = z.object({
  evidence_type: z.enum(['photo', 'video', 'document', 'receipt', 'other'])
});
