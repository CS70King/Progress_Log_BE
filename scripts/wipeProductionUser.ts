#!/usr/bin/env tsx

import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { MilestoneStatus } from '@prisma/client';
import { comparePassword } from '../src/utils/password';
import { env } from '../src/config/env';
import { prisma } from '../src/db/prisma';
import { storage } from '../src/storage';

const promptForSecret = async (label: string) => {
  if (!input.isTTY) {
    throw new Error('Interactive password entry requires a TTY.');
  }

  return new Promise<string>((resolve, reject) => {
    let value = '';

    const cleanup = () => {
      input.off('data', onData);
      input.setRawMode(false);
      input.pause();
      output.write('\n');
    };

    const onData = (chunk: Buffer) => {
      const key = chunk.toString('utf8');

      if (key === '\u0003') {
        cleanup();
        reject(new Error('User cancelled the wipe operation.'));
        return;
      }

      if (key === '\r' || key === '\n') {
        cleanup();
        resolve(value.trim());
        return;
      }

      if (key === '\u0008' || key === '\u007f') {
        value = value.slice(0, -1);
        return;
      }

      if (key >= ' ') {
        value += key;
      }
    };

    output.write(label);
    input.resume();
    input.setRawMode(true);
    input.on('data', onData);
  });
};

const getPhoneNumber = async () => {
  if (process.argv[2]) {
    return process.argv[2].trim();
  }

  const rl = readline.createInterface({ input, output });
  try {
    return (await rl.question('User phone number: ')).trim();
  } finally {
    rl.close();
  }
};

const unique = <T>(values: T[]) => Array.from(new Set(values));

async function main() {
  if (env.NODE_ENV !== 'production') {
    console.error('This script is intended for the production environment only.');
    console.error(`Current environment: ${env.NODE_ENV}`);
    console.error('For development or staging, use wipeDatabase.ts instead.');
    process.exit(1);
  }

  const phone = await getPhoneNumber();
  if (!phone) {
    console.error('A user phone number is required.');
    process.exit(1);
  }

  console.log('Starting production user wipe...');
  console.log(`User phone: ${phone}`);

  try {
    const user = await prisma.user.findUnique({
      where: { phone },
      select: {
        id: true,
        role: true,
        name: true,
        phone: true,
        passwordHash: true
      }
    });

    if (!user) {
      console.error(`User with phone ${phone} not found.`);
      process.exit(1);
    }

    const password = await promptForSecret('Password: ');
    const passwordMatches = await comparePassword(password, user.passwordHash);
    if (!passwordMatches) {
      console.error('Password verification failed. Wipe aborted.');
      process.exit(1);
    }

    const ownedProjects = await prisma.project.findMany({
      where: { ownerId: user.id },
      select: { id: true }
    });
    const ownedProjectIds = ownedProjects.map((project) => project.id);

    const milestoneWhere = [
      { createdBy: user.id },
      ...(ownedProjectIds.length ? [{ projectId: { in: ownedProjectIds } }] : [])
    ];
    const milestonesToDelete = await prisma.milestone.findMany({
      where: { OR: milestoneWhere },
      select: { id: true }
    });
    const milestoneIdsToDelete = milestonesToDelete.map((milestone) => milestone.id);

    const snapshotWhere = [
      { createdBy: user.id },
      ...(ownedProjectIds.length ? [{ projectId: { in: ownedProjectIds } }] : [])
    ];
    const snapshotsToDelete = await prisma.snapshot.findMany({
      where: { OR: snapshotWhere },
      select: { id: true }
    });
    const snapshotIdsToDelete = snapshotsToDelete.map((snapshot) => snapshot.id);

    const evidenceWhere = [
      { uploadedBy: user.id },
      ...(ownedProjectIds.length ? [{ projectId: { in: ownedProjectIds } }] : []),
      ...(milestoneIdsToDelete.length ? [{ milestoneId: { in: milestoneIdsToDelete } }] : [])
    ];
    const evidenceToDelete = await prisma.evidenceItem.findMany({
      where: { OR: evidenceWhere },
      select: {
        id: true,
        filePath: true,
        thumbnailPath: true
      }
    });
    const evidenceIdsToDelete = evidenceToDelete.map((evidence) => evidence.id);

    const reviewWhere = [
      { reviewerId: user.id },
      ...(milestoneIdsToDelete.length ? [{ milestoneId: { in: milestoneIdsToDelete } }] : [])
    ];
    const reviewsToDelete = await prisma.milestoneReview.findMany({
      where: { OR: reviewWhere },
      select: { id: true, milestoneId: true, reviewerId: true }
    });
    const reviewIdsToDelete = reviewsToDelete.map((review) => review.id);
    const survivingMilestonesNeedingReset = unique(
      reviewsToDelete.filter((review) => review.reviewerId === user.id && !milestoneIdsToDelete.includes(review.milestoneId)).map((review) => review.milestoneId)
    );

    const shareLinkWhere = [
      { createdBy: user.id },
      ...(ownedProjectIds.length
        ? [
            {
              resourceType: 'PROJECT' as const,
              resourceId: { in: ownedProjectIds }
            }
          ]
        : []),
      ...(snapshotIdsToDelete.length
        ? [
            {
              resourceType: 'SNAPSHOT' as const,
              resourceId: { in: snapshotIdsToDelete }
            }
          ]
        : [])
    ];
    const shareLinksToDelete = await prisma.shareLink.findMany({
      where: { OR: shareLinkWhere },
      select: { id: true }
    });
    const shareLinkIdsToDelete = shareLinksToDelete.map((shareLink) => shareLink.id);

    const membershipWhere = [
      { userId: user.id },
      ...(ownedProjectIds.length ? [{ projectId: { in: ownedProjectIds } }] : [])
    ];
    const membershipsToDelete = await prisma.projectMember.findMany({
      where: { OR: membershipWhere },
      select: { id: true }
    });
    const membershipIdsToDelete = membershipsToDelete.map((membership) => membership.id);

    console.log('Deletion scope:');
    console.log(`- User: ${user.name} (${user.role})`);
    console.log(`- Owned projects: ${ownedProjectIds.length}`);
    console.log(`- Milestones: ${milestoneIdsToDelete.length}`);
    console.log(`- Evidence items: ${evidenceIdsToDelete.length}`);
    console.log(`- Reviews: ${reviewIdsToDelete.length}`);
    console.log(`- Snapshots: ${snapshotIdsToDelete.length}`);
    console.log(`- Share links: ${shareLinkIdsToDelete.length}`);
    console.log(`- Project memberships: ${membershipIdsToDelete.length}`);

    console.log('\nWARNING: This will permanently delete this user and all deletable records owned by or attached to that user.');
    console.log('This action cannot be undone.');
    console.log(`Type "DELETE USER ${phone}" to continue.`);

    const rl = readline.createInterface({ input, output });
    try {
      const confirmation = (await rl.question('Confirmation: ')).trim();
      if (confirmation !== `DELETE USER ${phone}`) {
        console.log('Deletion cancelled by user.');
        process.exit(0);
      }
    } finally {
      rl.close();
    }

    console.log('\nDeleting stored evidence files...');
    for (const evidence of evidenceToDelete) {
      await storage.deleteEvidenceFile(env.SUPABASE_STORAGE_BUCKET, evidence.filePath).catch(() => undefined);
      if (evidence.thumbnailPath) {
        await storage.deleteEvidenceFile(env.SUPABASE_STORAGE_BUCKET, evidence.thumbnailPath).catch(() => undefined);
      }
    }

    await prisma.$transaction(async (tx) => {
      if (shareLinkIdsToDelete.length) {
        await tx.shareLink.deleteMany({
          where: { id: { in: shareLinkIdsToDelete } }
        });
      }

      if (snapshotIdsToDelete.length) {
        await tx.snapshot.deleteMany({
          where: { id: { in: snapshotIdsToDelete } }
        });
      }

      if (evidenceIdsToDelete.length) {
        await tx.evidenceItem.deleteMany({
          where: { id: { in: evidenceIdsToDelete } }
        });
      }

      if (reviewIdsToDelete.length) {
        await tx.milestoneReview.deleteMany({
          where: { id: { in: reviewIdsToDelete } }
        });
      }

      if (survivingMilestonesNeedingReset.length) {
        await tx.milestone.updateMany({
          where: { id: { in: survivingMilestonesNeedingReset } },
          data: {
            status: MilestoneStatus.SUBMITTED
          }
        });
      }

      if (milestoneIdsToDelete.length) {
        await tx.milestone.deleteMany({
          where: { id: { in: milestoneIdsToDelete } }
        });
      }

      if (membershipIdsToDelete.length) {
        await tx.projectMember.deleteMany({
          where: { id: { in: membershipIdsToDelete } }
        });
      }

      if (ownedProjectIds.length) {
        await tx.project.deleteMany({
          where: { id: { in: ownedProjectIds } }
        });
      }

      await tx.user.delete({
        where: { id: user.id }
      });
    });

    console.log('Production user wipe completed successfully.');
    console.log(`User ${phone} and related data have been permanently removed.`);
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}
