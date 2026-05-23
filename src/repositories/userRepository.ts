import { Prisma, UserRole } from '@prisma/client';
import { prisma } from '../db/prisma';

export const userRepository = {
  create(data: Prisma.UserCreateInput) {
    return prisma.user.create({ data });
  },

  findByPhone(phone: string) {
    return prisma.user.findUnique({ where: { phone } });
  },

  findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  recordFailedLoginAttempt(userId: string, failedLoginAttempts: number, lockedUntil: Date | null) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts,
        lockedUntil
      }
    });
  },

  clearLoginProtection(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null
      }
    });
  },

  bumpTokenVersion(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        tokenVersion: {
          increment: 1
        }
      }
    });
  },

  findReviewerByPhone(phone: string) {
    return prisma.user.findFirst({
      where: {
        phone,
        role: UserRole.REVIEWER
      }
    });
  }
};
