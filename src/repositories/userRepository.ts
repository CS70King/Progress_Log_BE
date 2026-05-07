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

  findReviewerByPhone(phone: string) {
    return prisma.user.findFirst({
      where: {
        phone,
        role: UserRole.REVIEWER
      }
    });
  }
};
