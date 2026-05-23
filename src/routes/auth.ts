import { Router } from 'express';
import { env } from '../config/env';
import { authController } from '../controllers/authController';
import { requireAuth } from '../middlewares/auth';
import { createRateLimit } from '../middlewares/rateLimit';
import { validateBody } from '../middlewares/validate';
import { loginSchema, signupSchema } from '../validators/authSchemas';
import { asyncHandler } from '../utils/asyncHandler';

export const authRouter = Router();

const signupRateLimit = createRateLimit({
  keyPrefix: 'auth-signup',
  windowMs: env.AUTH_SIGNUP_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_SIGNUP_RATE_LIMIT_MAX,
  resolveKey: (req) => `${req.ip || 'unknown'}:${String(req.body?.phone || 'unknown')}`
});

const loginRateLimit = createRateLimit({
  keyPrefix: 'auth-login',
  windowMs: env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_LOGIN_RATE_LIMIT_MAX,
  resolveKey: (req) => `${req.ip || 'unknown'}:${String(req.body?.phone || 'unknown')}`
});

authRouter.post('/signup', signupRateLimit, validateBody(signupSchema), asyncHandler(authController.signup));
authRouter.post('/login', loginRateLimit, validateBody(loginSchema), asyncHandler(authController.login));
authRouter.get('/me', requireAuth, asyncHandler(authController.me));
