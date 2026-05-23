import { z } from 'zod';

export const reviewMilestoneSchema = z
  .object({
    decision: z.enum(['approved', 'needs_revision']),
    note: z.string().trim().min(5).max(2000, 'Review note must be at most 2000 characters').optional()
  })
  .superRefine((value, ctx) => {
    if (value.decision === 'needs_revision' && !value.note) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['note'],
        message: 'note is required when decision is needs_revision'
      });
    }
  });
