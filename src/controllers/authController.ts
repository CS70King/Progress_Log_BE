import { Request, Response } from 'express';
import { authService } from '../services/authService';
import { sendSuccess } from '../utils/apiResponse';
import { logger, maskPhone } from '../utils/logger';

export const authController = {
  async signup(req: Request, res: Response) {
    logger.info('auth.signup.controller.start', {
      phone: maskPhone(req.body.phone),
      role: req.body.role
    });
    const result = await authService.signup(req.body);
    return sendSuccess(res, 'Signup successful', result, 201);
  },

  async login(req: Request, res: Response) {
    logger.info('auth.login.controller.start', {
      phone: maskPhone(req.body.phone)
    });
    const result = await authService.login(req.body);
    return sendSuccess(res, 'Login successful', result);
  },

  async me(req: Request, res: Response) {
    logger.info('auth.me.controller.start', {
      userId: req.auth!.userId
    });
    const result = await authService.me(req.auth!.userId);
    return sendSuccess(res, 'User profile fetched successfully', result);
  }
};
