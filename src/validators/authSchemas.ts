import { z } from 'zod';

export const signupSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(5),
  country: z.string().trim().min(1, 'Country is required'),
  company: z.string().trim().min(1).optional(),
  role: z.enum(['worker', 'reviewer']),
  pin: z.string().regex(/^\d{4}$/)
});

export const loginSchema = z.object({
  phone: z.string().min(5),
  pin: z.string().regex(/^\d{4}$/)
});
