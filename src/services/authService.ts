import { UserRole } from '@prisma/client';
import { presentUser } from '../models/presenters';
import { userRepository } from '../repositories/userRepository';
import { AppError } from '../utils/appError';
import { toUserRole } from '../utils/enums';
import { signAccessToken } from '../utils/jwt';
import { logger, maskPhone } from '../utils/logger';
import { comparePin, hashPin } from '../utils/password';

export const authService = {
  async signup(input: {
    name: string;
    phone: string;
    country: string;
    company?: string;
    role: 'worker' | 'reviewer';
    pin: string;
  }) {
    logger.info('auth.signup.service.start', {
      phone: maskPhone(input.phone),
      role: input.role
    });

    const existingUser = await userRepository.findByPhone(input.phone);
    if (existingUser) {
      logger.warn('auth.signup.service.duplicate_phone', {
        phone: maskPhone(input.phone)
      });
      throw new AppError(409, 'Phone number is already registered', 'CONFLICT');
    }

    const user = await userRepository.create({
      name: input.name,
      phone: input.phone,
      country: input.country,
      company: input.company,
      role: toUserRole(input.role),
      passwordHash: await hashPin(input.pin)
    });

    logger.info('auth.signup.service.created_user', {
      userId: user.id,
      role: user.role,
      phone: maskPhone(user.phone)
    });

    return {
      user: presentUser(user),
      token: signAccessToken({
        userId: user.id,
        role: user.role
      })
    };
  },

  async login(input: { phone: string; pin: string }) {
    logger.info('auth.login.service.start', {
      phone: maskPhone(input.phone)
    });

    const user = await userRepository.findByPhone(input.phone);
    if (!user) {
      logger.warn('auth.login.service.user_not_found', {
        phone: maskPhone(input.phone)
      });
      throw new AppError(401, 'Invalid phone or PIN', 'UNAUTHORIZED');
    }

    const matches = await comparePin(input.pin, user.passwordHash);
    if (!matches) {
      logger.warn('auth.login.service.invalid_pin', {
        userId: user.id,
        phone: maskPhone(user.phone)
      });
      throw new AppError(401, 'Invalid phone or PIN', 'UNAUTHORIZED');
    }

    logger.info('auth.login.service.success', {
      userId: user.id,
      role: user.role
    });

    return {
      user: presentUser(user),
      token: signAccessToken({
        userId: user.id,
        role: user.role
      })
    };
  },

  async me(userId: string) {
    logger.info('auth.me.service.start', {
      userId
    });

    const user = await userRepository.findById(userId);
    if (!user) {
      logger.warn('auth.me.service.user_not_found', {
        userId
      });
      throw new AppError(404, 'User not found', 'NOT_FOUND');
    }

    return presentUser(user);
  },

  async assertActiveUser(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) {
      logger.warn('auth.active_user.not_found', {
        userId
      });
      throw new AppError(401, 'Authenticated user no longer exists. Please log in again.', 'UNAUTHORIZED');
    }

    return user;
  },

  ensureWorkerRole(role: UserRole) {
    if (role !== UserRole.WORKER) {
      logger.warn('auth.ensure_worker_role.denied', {
        role
      });
      throw new AppError(403, 'Only workers can perform this action', 'FORBIDDEN');
    }
  }
};
