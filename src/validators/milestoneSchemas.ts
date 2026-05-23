import { z } from 'zod';

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const milestoneIdParamSchema = z.object({
  milestoneId: z.string().uuid()
});

export const createMilestoneSchema = z.object({
  title: z.string().trim().min(1, 'Milestone title is required').max(160, 'Milestone title must be at most 160 characters'),
  description: z
    .string()
    .trim()
    .min(1, 'Milestone description is required')
    .max(4000, 'Milestone description must be at most 4000 characters'),
  activity_date: dateOnly,
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional()
});

export const updateMilestoneSchema = z
  .object({
    title: z.string().trim().min(1).max(160, 'Milestone title must be at most 160 characters').optional(),
    description: z
      .string()
      .trim()
      .min(1)
      .max(4000, 'Milestone description must be at most 4000 characters')
      .optional(),
    activity_date: dateOnly.optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required'
  });
