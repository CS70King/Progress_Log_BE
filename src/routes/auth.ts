import { Router } from 'express';
import { authController } from '../controllers/authController';
import { requireAuth } from '../middlewares/auth';
import { validateBody } from '../middlewares/validate';
import { loginSchema, signupSchema } from '../validators/authSchemas';
import { asyncHandler } from '../utils/asyncHandler';

export const authRouter = Router();

authRouter.post('/signup', validateBody(signupSchema), asyncHandler(authController.signup));
authRouter.post('/login', validateBody(loginSchema), asyncHandler(authController.login));
authRouter.get('/me', requireAuth, asyncHandler(authController.me));










