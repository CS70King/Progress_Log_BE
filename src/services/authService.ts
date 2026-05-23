import { UserRole } from '@prisma/client';
import { env } from '../config/env';
import { presentUser } from '../models/presenters';
import { userRepository } from '../repositories/userRepository';
import { AppError } from '../utils/appError';
import { toUserRole } from '../utils/enums';
import { signAccessToken } from '../utils/jwt';
import { logger, maskPhone } from '../utils/logger';
import { comparePassword, hashPassword } from '../utils/password';

const buildAccountLockedError = (lockedUntil: Date) => {
  return new AppError(
    423,
    `Too many failed login attempts. Try again after ${lockedUntil.toISOString()}`,
    'ACCOUNT_LOCKED'
  );
};

export const authService = {
  async signup(input: {
    name: string;
    phone: string;
    country: string;
    company?: string;
    role: 'worker' | 'reviewer';
    password: string;
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
      passwordHash: await hashPassword(input.password)
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
        role: user.role,
        tokenVersion: user.tokenVersion
      })
    };
  },

  async login(input: { phone: string; password: string }) {
    logger.info('auth.login.service.start', {
      phone: maskPhone(input.phone)
    });

    const user = await userRepository.findByPhone(input.phone);
    if (!user) {
      logger.warn('auth.login.service.user_not_found', {
        phone: maskPhone(input.phone)
      });
      throw new AppError(401, 'Invalid phone or password', 'UNAUTHORIZED');
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      logger.warn('auth.login.service.account_locked', {
        userId: user.id,
        phone: maskPhone(user.phone),
        lockedUntil: user.lockedUntil.toISOString()
      });
      throw buildAccountLockedError(user.lockedUntil);
    }

    const matches = await comparePassword(input.password, user.passwordHash);
    if (!matches) {
      const nextFailedAttempts = user.failedLoginAttempts + 1;
      const shouldLockAccount = nextFailedAttempts >= env.AUTH_ACCOUNT_LOCK_THRESHOLD;
      const lockedUntil = shouldLockAccount ? new Date(Date.now() + env.AUTH_ACCOUNT_LOCK_DURATION_MS) : null;

      await userRepository.recordFailedLoginAttempt(
        user.id,
        shouldLockAccount ? 0 : nextFailedAttempts,
        lockedUntil
      );

      logger.warn('auth.login.service.invalid_password', {
        userId: user.id,
        phone: maskPhone(user.phone),
        failedAttempts: shouldLockAccount ? env.AUTH_ACCOUNT_LOCK_THRESHOLD : nextFailedAttempts,
        lockedUntil: lockedUntil?.toISOString() ?? null
      });

      if (lockedUntil) {
        throw buildAccountLockedError(lockedUntil);
      }

      throw new AppError(401, 'Invalid phone or password', 'UNAUTHORIZED');
    }

    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await userRepository.clearLoginProtection(user.id);
    }

    logger.info('auth.login.service.success', {
      userId: user.id,
      role: user.role
    });

    return {
      user: presentUser(user),
      token: signAccessToken({
        userId: user.id,
        role: user.role,
        tokenVersion: user.tokenVersion
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
