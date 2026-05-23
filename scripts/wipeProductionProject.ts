#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import { env } from '../src/config/env';

const prisma = new PrismaClient();

async function main() {
  const projectId = process.argv[2];
  
  if (!projectId) {
    console.error('❌ Project ID is required!');
    console.error('   Usage: tsx scripts/wipeProductionProject.ts <project-id>');
    console.error('   Example: tsx scripts/wipeProductionProject.ts abc123-def456-ghi789');
    process.exit(1);
  }

  if (env.NODE_ENV !== 'production') {
    console.error('❌ This script is intended for production environment only!');
    console.error(`   Current environment: ${env.NODE_ENV}`);
    console.error('   For dev/staging, use wipeDatabase.ts instead.');
    process.exit(1);
  }

  console.log(`🗑️  Starting project deletion for production environment...`);
  console.log(`🆔 Project ID: ${projectId}`);
  
  try {
    // First, check if project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        milestones: {
          include: {
            evidenceItems: true,
            review: true
          }
        },
        members: true
      }
    });

    if (!project) {
      console.error(`❌ Project with ID ${projectId} not found!`);
      process.exit(1);
    }

    console.log(`📋 Found project: ${project.title}`);
    console.log(`📊 Statistics:`);
    console.log(`   - Milestones: ${project.milestones.length}`);
    console.log(`   - Evidence items: ${project.milestones.reduce((sum, m) => sum + m.evidenceItems.length, 0)}`);
    console.log(`   - Team members: ${project.members.length}`);

    // Confirm deletion
    console.log('\n⚠️  WARNING: This will permanently delete the entire project and all associated data!');
    console.log('   This action cannot be undone.');
    console.log('\n🔒 To confirm deletion, please type "DELETE" and press Enter:');
    
    // For automation, you can skip confirmation by setting environment variable
    const skipConfirmation = process.env.SKIP_CONFIRMATION === 'true';
    
    if (!skipConfirmation) {
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const confirmation = await new Promise<string>((resolve) => {
        rl.question('Confirmation: ', (answer: string) => {
          rl.close();
          resolve(answer.trim());
        });
      });

      if (confirmation !== 'DELETE') {
        console.log('❌ Deletion cancelled by user.');
        process.exit(0);
      }
    }

    // Delete in correct order due to foreign key constraints
    console.log('\n🗑️  Deleting evidence items...');
    for (const milestone of project.milestones) {
      await prisma.evidenceItem.deleteMany({
        where: { milestoneId: milestone.id }
      });
    }

    console.log('🗑️  Deleting milestone reviews...');
    await prisma.milestoneReview.deleteMany({
      where: { milestoneId: { in: project.milestones.map(m => m.id) } }
    });

    console.log('🗑️  Deleting milestones...');
    await prisma.milestone.deleteMany({
      where: { projectId: projectId }
    });

    console.log('🗑️  Deleting project members...');
    await prisma.projectMember.deleteMany({
      where: { projectId: projectId }
    });

    console.log('🗑️  Deleting project...');
    await prisma.project.delete({
      where: { id: projectId }
    });

    console.log('✅ Project deletion completed successfully!');
    console.log(`📋 Project "${project.title}" and all associated data have been permanently removed.`);

  } catch (error) {
    console.error('❌ Error deleting project:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}
