import { z } from 'zod';

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const milestoneIdParamSchema = z.object({
  milestoneId: z.string().uuid()
});

export const createMilestoneSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  activity_date: dateOnly,
  tags: z.array(z.string()).optional()
});

export const updateMilestoneSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    activity_date: dateOnly.optional(),
    tags: z.array(z.string()).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required'
  });
