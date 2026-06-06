#!/usr/bin/env tsx

import { env } from '../src/config/env';
import { prisma } from '../src/db/prisma';
import { storage } from '../src/storage';

async function main() {
  console.log(`Starting database wipe for ${env.NODE_ENV} environment...`);

  if (env.NODE_ENV !== 'development' && env.NODE_ENV !== 'staging') {
    console.error('Database wipe is only allowed in development or staging.');
    console.error(`Current environment: ${env.NODE_ENV}`);
    process.exit(1);
  }

  try {
    const storedEvidence = await prisma.evidenceItem.findMany({
      select: {
        filePath: true,
        thumbnailPath: true
      }
    });

    console.log('Deleting stored evidence files...');
    for (const item of storedEvidence) {
      await storage.deleteEvidenceFile(env.SUPABASE_STORAGE_BUCKET, item.filePath).catch(() => undefined);
      if (item.thumbnailPath) {
        await storage.deleteEvidenceFile(env.SUPABASE_STORAGE_BUCKET, item.thumbnailPath).catch(() => undefined);
      }
    }

    console.log('Deleting share links...');
    await prisma.shareLink.deleteMany();

    console.log('Deleting snapshots...');
    await prisma.snapshot.deleteMany();

    console.log('Deleting evidence items...');
    await prisma.evidenceItem.deleteMany();

    console.log('Deleting milestone reviews...');
    await prisma.milestoneReview.deleteMany();

    console.log('Deleting milestones...');
    await prisma.milestone.deleteMany();

    console.log('Deleting project members...');
    await prisma.projectMember.deleteMany();

    console.log('Deleting projects...');
    await prisma.project.deleteMany();

    console.log('Deleting users...');
    await prisma.user.deleteMany();

    console.log('Database wipe completed successfully.');
    console.log('All data has been removed from the database.');
  } catch (error) {
    console.error('Error wiping database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}
