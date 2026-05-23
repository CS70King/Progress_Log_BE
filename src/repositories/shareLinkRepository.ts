import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';

export const shareLinkRepository = {
  create(data: Prisma.ShareLinkCreateInput) {
    return prisma.shareLink.create({ data });
  },

  findById(id: string) {
    return prisma.shareLink.findUnique({
      where: { id }
    });
  },

  findByToken(token: string) {
    return prisma.shareLink.findUnique({
      where: { token }
    });
  },

  revoke(id: string, revokedAt: Date) {
    return prisma.shareLink.update({
      where: { id },
      data: {
        revokedAt
      }
    });
  }
};
