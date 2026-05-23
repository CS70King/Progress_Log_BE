import { z } from 'zod';

export const phoneSchema = z
  .string()
  .trim()
  .min(5, 'Phone number must be at least 5 characters')
  .max(32, 'Phone number must be at most 32 characters')
  .regex(/^[0-9+\-\s()]+$/, 'Phone number contains invalid characters');

export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Za-z]/, 'Password must include at least one letter')
  .regex(/\d/, 'Password must include at least one number')
  .refine((value) => value === value.trim(), 'Password cannot start or end with spaces');

export const signupSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
  phone: phoneSchema,
  country: z.string().trim().min(1, 'Country is required').max(80, 'Country must be at most 80 characters'),
  company: z.string().trim().min(1).max(120, 'Company must be at most 120 characters').optional(),
  role: z.enum(['worker', 'reviewer']),
  password: passwordSchema
});

export const loginSchema = z.object({
  phone: phoneSchema,
  password: passwordSchema
});
