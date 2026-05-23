import { z } from 'zod';
import { phoneSchema } from './authSchemas';

export const projectIdParamSchema = z.object({
  projectId: z.string().uuid()
});

export const createProjectSchema = z.object({
  title: z.string().trim().min(1, 'Project title is required').max(160, 'Project title must be at most 160 characters'),
  description: z
    .string()
    .trim()
    .max(4000, 'Project description must be at most 4000 characters')
    .optional(),
  project_type: z.enum(['generic', 'construction', 'service'], {
    required_error: 'Project type is required',
    invalid_type_error: 'Project type must be generic, construction, or service'
  }),
  reviewer_phone: phoneSchema.optional(),
  reviewer_phones: z
    .array(phoneSchema)
    .max(3, 'You can add up to 3 reviewers when creating a project')
    .optional()
}).superRefine((value, ctx) => {
  if (value.reviewer_phone && value.reviewer_phones) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['reviewer_phones'],
      message: 'Use reviewer_phones for multiple reviewers, or reviewer_phone for one reviewer, but not both'
    });
  }
});

export const inviteReviewerSchema = z.object({
  reviewer_phone: phoneSchema
});
