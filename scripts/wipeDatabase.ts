#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import { env } from '../src/config/env';

const prisma = new PrismaClient();

async function main() {
  console.log(`🧹 Starting database wipe for ${env.NODE_ENV} environment...`);
  
  if (env.NODE_ENV === 'production') {
    console.error('❌ Database wipe is not allowed in production environment!');
    console.error('   Use wipeProductionProject.ts with specific project ID instead.');
    process.exit(1);
  }

  try {
    // Delete in correct order due to foreign key constraints
    console.log('🗑️  Deleting evidence items...');
    await prisma.evidenceItem.deleteMany();

    console.log('🗑️  Deleting milestone reviews...');
    await prisma.milestoneReview.deleteMany();

    console.log('🗑️  Deleting milestones...');
    await prisma.milestone.deleteMany();

    console.log('🗑️  Deleting project members...');
    await prisma.projectMember.deleteMany();

    console.log('🗑️  Deleting projects...');
    await prisma.project.deleteMany();

    console.log('🗑️  Deleting users...');
    await prisma.user.deleteMany();

    console.log('✅ Database wipe completed successfully!');
    console.log('📊 All data has been removed from the database.');

  } catch (error) {
    console.error('❌ Error wiping database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}
