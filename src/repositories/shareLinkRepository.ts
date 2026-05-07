import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';

export const shareLinkRepository = {
  create(data: Prisma.ShareLinkCreateInput) {
    return prisma.shareLink.create({ data });
  },

  findByToken(token: string) {
    return prisma.shareLink.findUnique({
      where: { token }
    });
  }
};
