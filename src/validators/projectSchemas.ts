import { z } from 'zod';

export const projectIdParamSchema = z.object({
  projectId: z.string().uuid()
});

export const createProjectSchema = z.object({
  title: z.string().min(1, 'Project title is required'),
  description: z.string().optional(),
  project_type: z.enum(['generic', 'construction', 'service'], {
    required_error: 'Project type is required',
    invalid_type_error: 'Project type must be generic, construction, or service'
  }),
  reviewer_phone: z.string().min(5, 'Reviewer phone number must be at least 5 characters').optional(),
  reviewer_phones: z
    .array(z.string().min(5, 'Each reviewer phone number must be at least 5 characters'))
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
  reviewer_phone: z.string().min(5, 'Reviewer phone number must be at least 5 characters')
});
