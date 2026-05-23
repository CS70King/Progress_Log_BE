#!/usr/bin/env tsx

import { PrismaClient, ProjectMemberRole, MilestoneStatus, ReviewDecision, ProjectType, ProjectState, EvidenceType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from '../src/utils/password';
import { ImageService } from '../src/services/imageService';
import { env } from '../src/config/env';
import { storage } from '../src/storage';
import axios from 'axios';

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL
});

const prisma = new PrismaClient({ adapter });

const WORKER_SEED_PASSWORD = 'WorkerDemo123!';
const REVIEWER_SEED_PASSWORD = 'ReviewerDemo123!';

// Realistic construction project data
const projectTitles = [
  'Downtown Office Tower Renovation',
  'Highway Bridge Construction',
  'Residential Complex Phase 2',
  'Shopping Mall Expansion',
  'School Building Modernization',
  'Hospital Wing Addition',
  'Industrial Warehouse Complex',
  'Water Treatment Plant Upgrade',
  'Sports Stadium Construction',
  'Airport Terminal Renovation'
];

const projectDescriptions = [
  'Complete renovation of 20-story office building with modern amenities and energy-efficient systems',
  'Construction of 2-mile highway bridge with pedestrian walkway and bicycle lane',
  'Development of 150-unit residential complex with underground parking and community facilities',
  'Expansion of existing shopping mall with 50 new retail spaces and food court',
  'Complete modernization of 30-year-old school building with new classrooms and technology infrastructure',
  'Addition of new hospital wing with 100 beds, surgical suites, and diagnostic facilities',
  'Construction of 500,000 sq ft warehouse complex with loading docks and office space',
  'Upgrade of aging water treatment facility with new filtration systems and capacity expansion',
  'New 45,000-seat sports stadium with modern amenities and concession facilities',
  'Complete renovation of airport terminal with expanded security areas and passenger facilities'
];

const milestoneTitles = [
  'Site Preparation and Excavation',
  'Foundation Work',
  'Steel Frame Installation',
  'Exterior Envelope Completion',
  'Roofing Installation',
  'Interior Framing',
  'MEP Systems Installation',
  'Interior Finishes',
  'Landscaping and Site Work',
  'Final Inspections and Commissioning'
];

const milestoneDescriptions = [
  'Complete site clearing, grading, and excavation to required depths',
  'Pour concrete foundations, footings, and slab work according to structural specifications',
  'Erect structural steel frame including columns, beams, and bracing systems',
  'Install exterior walls, windows, and building envelope systems',
  'Complete roofing system installation including waterproofing and insulation',
  'Install interior partition walls, door frames, and structural components',
  'Install mechanical, electrical, and plumbing systems throughout building',
  'Complete interior finishes including flooring, painting, and fixtures',
  'Complete exterior landscaping, parking lots, and site improvements',
  'Conduct final inspections, testing, and commissioning of all systems'
];

// Realistic evidence descriptions
const evidenceDescriptions = [
  'Initial site survey and grading measurements',
  'Foundation concrete pour with rebar placement verification',
  'Steel beam installation with bolt torque verification',
  'Window installation with weatherproofing detail',
  'Roofing membrane installation with seam welding',
  'Interior wall framing with electrical rough-in',
  'HVAC ductwork installation and testing',
  'Finished flooring with transition details',
  'Final landscaping and irrigation system',
  'Final inspection walkthrough with punch list items'
];

// Realistic image URLs from Picsum with construction-related seeds
const getImageUrls = (count: number, baseSeed: string): string[] => {
  return Array.from({ length: count }, (_, i) => 
    `https://picsum.photos/seed/${baseSeed}-${i + 1}/800/600.jpg`
  );
};

const getRandomElement = <T>(array: T[]): T => {
  return array[Math.floor(Math.random() * array.length)];
};

const getRandomElements = <T>(array: T[], count: number): T[] => {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

const getRandomInt = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const getRandomDate = (start: Date, end: Date): Date => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

// Function to create realistic evidence with thumbnail metadata (but no actual upload for now)
const createRealImageEvidence = async (
  projectId: string, 
  milestoneId: string, 
  workerId: string, 
  evidenceIndex: number,
  projectIndex: number,
  milestoneIndex: number
) => {
  try {
    // Download a real image from Picsum to get buffer
    const imageUrl = `https://picsum.photos/seed/progress-log-${projectIndex}-${milestoneIndex}-${evidenceIndex}/800/600.jpg`;
    const response = await fetch(imageUrl);
    const imageBuffer = Buffer.from(await response.arrayBuffer());
    
    // Generate filename and paths
    const originalFilename = `evidence-${evidenceIndex + 1}.jpg`;
    const filePath = `projects/${projectId}/milestones/${milestoneId}/${originalFilename}`;
    
    // Generate thumbnail using our ImageService
    const thumbnail = await ImageService.generateThumbnail(imageBuffer);
    const thumbnailPath = ImageService.getThumbnailPath(filePath);
    
    // Extract image metadata
    const metadata = await ImageService.extractMetadata(imageBuffer);
    
    // Create database record with all metadata using raw SQL
    const evidence = await prisma.evidenceItem.create({
      data: {
        projectId,
        milestoneId,
        uploadedBy: workerId,
        evidenceType: 'PHOTO',
        originalFilename,
        filePath,
        contentType: 'image/jpeg',
        sizeBytes: BigInt(imageBuffer.length)
      }
    });
    
    // Update with image metadata using raw SQL
    await prisma.$executeRaw`
      UPDATE evidence_items 
      SET 
        width = ${metadata.width},
        height = ${metadata.height},
        thumbnail_path = ${thumbnailPath},
        thumbnail_size = ${thumbnail.size},
        thumbnail_width = ${thumbnail.width},
        thumbnail_height = ${thumbnail.height}
      WHERE id = ${evidence.id}
    `;
    
    console.log(`✅ Created image evidence with metadata: ${originalFilename} (${imageBuffer.length} bytes)`);
    console.log(`   Dimensions: ${metadata.width}x${metadata.height}, Thumbnail: ${thumbnail.width}x${thumbnail.height} (${thumbnail.size} bytes)`);
    
    return evidence;
    
  } catch (error) {
    console.error(`❌ Failed to create image evidence:`, error);
    throw error;
  }
};

const createWorker = async () => {
  const hashedPassword = await hashPassword(WORKER_SEED_PASSWORD);
  
  return await prisma.user.create({
    data: {
      name: 'John Construction Manager',
      phone: '+15555550100',
      country: 'United States',
      company: 'BuildRight Construction',
      role: 'WORKER',
      passwordHash: hashedPassword
    }
  });
};

const createReviewer = async () => {
  const hashedPassword = await hashPassword(REVIEWER_SEED_PASSWORD);
  
  return await prisma.user.create({
    data: {
      name: 'Sarah Quality Inspector',
      phone: '+15555550200',
      country: 'United States',
      company: 'Quality Assurance Partners',
      role: 'REVIEWER',
      passwordHash: hashedPassword
    }
  });
};

const createProjectWithMilestones = async (workerId: string, reviewerId: string, projectIndex: number) => {
  const projectType = getRandomElement<ProjectType>(['GENERIC', 'CONSTRUCTION', 'SERVICE']);
  const projectState = getRandomElement<ProjectState>(['ACTIVE', 'COMPLETED', 'ABANDONED']);
  const projectTitle = projectTitles[projectIndex % projectTitles.length];
  const projectDescription = projectDescriptions[projectIndex % projectDescriptions.length];
  
  const project = await prisma.project.create({
    data: {
      title: projectTitle,
      description: projectDescription,
      projectType,
      state: projectState,
      ownerId: workerId,
      members: {
        create: {
          userId: reviewerId,
          role: ProjectMemberRole.REVIEWER
        }
      }
    }
  });

  // Create 5-15 milestones per project
  const milestoneCount = getRandomInt(5, 15);
  const milestones = [];
  
  for (let i = 0; i < milestoneCount; i++) {
    const milestoneTitle = milestoneTitles[i % milestoneTitles.length];
    const milestoneDescription = milestoneDescriptions[i % milestoneDescriptions.length];
    const activityDate = getRandomDate(new Date(2024, 0, 1), new Date(2024, 11, 31));
    
    // Determine milestone status based on project state
    let status: MilestoneStatus;
    if (projectState === 'COMPLETED') {
      status = MilestoneStatus.APPROVED;
    } else if (projectState === 'ABANDONED') {
      status = getRandomElement([MilestoneStatus.DRAFT, MilestoneStatus.SUBMITTED]);
    } else {
      status = getRandomElement([
        MilestoneStatus.DRAFT,
        MilestoneStatus.SUBMITTED,
        MilestoneStatus.APPROVED,
        MilestoneStatus.NEEDS_REVISION
      ]);
    }

    const milestone = await prisma.milestone.create({
      data: {
        title: milestoneTitle,
        description: milestoneDescription,
        activityDate,
        status,
        projectId: project.id,
        createdBy: workerId
      }
    });

    // Create evidence for milestones
    const evidenceCount = getRandomInt(3, 20); // Some milestones have up to 20 images
    const evidenceItems = [];
    
    for (let j = 0; j < evidenceCount; j++) {
      const evidenceType = getRandomElement<EvidenceType>(['PHOTO', 'DOCUMENT', 'RECEIPT']);
      
      if (evidenceType === 'PHOTO') {
        // Create real image evidence with thumbnails
        const evidence = await createRealImageEvidence(
          project.id,
          milestone.id,
          workerId,
          j,
          projectIndex,
          i
        );
        evidenceItems.push(evidence);
      } else {
        // Create fake document/receipt evidence
        const evidence = await prisma.evidenceItem.create({
          data: {
            projectId: project.id,
            milestoneId: milestone.id,
            uploadedBy: workerId,
            evidenceType,
            originalFilename: `evidence-${j + 1}.${evidenceType === 'DOCUMENT' ? 'pdf' : 'jpg'}`,
            filePath: `projects/${project.id}/milestones/${milestone.id}/evidence-${j + 1}.${evidenceType === 'DOCUMENT' ? 'pdf' : 'jpg'}`,
            contentType: evidenceType === 'DOCUMENT' ? 'application/pdf' : 'image/jpeg',
            sizeBytes: getRandomInt(500000, 5000000) // 0.5MB to 5MB
          }
        });
        evidenceItems.push(evidence);
      }
    }

    // Add review for submitted/approved milestones
    if (status === MilestoneStatus.APPROVED || status === MilestoneStatus.NEEDS_REVISION) {
      const reviewDecision = status === MilestoneStatus.APPROVED ? ReviewDecision.APPROVED : ReviewDecision.NEEDS_REVISION;
      const reviewNote = status === MilestoneStatus.APPROVED 
        ? 'Work meets all quality standards and specifications. Approved for next phase.'
        : 'Minor issues identified. Please address the following items before resubmission.';
      
      await prisma.milestoneReview.create({
        data: {
          milestoneId: milestone.id,
          reviewerId,
          decision: reviewDecision,
          note: reviewNote
        }
      });
    }

    milestones.push(milestone);
  }

  return { project, milestones };
};

const getProjectCount = (): number => {
  switch (env.NODE_ENV) {
    case 'development':
      return 10;
    case 'staging':
      return 5;
    case 'production':
      return 3;
    default:
      return 5;
  }
};

async function main() {
  console.log(`🌱 Starting database seeding for ${env.NODE_ENV} environment...`);
  
  try {
    // Clean existing data
    if (env.NODE_ENV === 'development' || env.NODE_ENV === 'staging') {
      console.log('🧹 Cleaning existing data...');
      await prisma.evidenceItem.deleteMany();
      await prisma.milestoneReview.deleteMany();
      await prisma.milestone.deleteMany();
      await prisma.projectMember.deleteMany();
      await prisma.project.deleteMany();
      await prisma.user.deleteMany();
    }

    // Create users
    console.log('👷 Creating worker...');
    const worker = await createWorker();
    
    console.log('🔍 Creating reviewer...');
    const reviewer = await createReviewer();

    // Create projects
    const projectCount = getProjectCount();
    console.log(`🏗️  Creating ${projectCount} projects...`);
    
    for (let i = 0; i < projectCount; i++) {
      console.log(`  Creating project ${i + 1}/${projectCount}: ${projectTitles[i % projectTitles.length]}`);
      await createProjectWithMilestones(worker.id, reviewer.id, i);
    }

    console.log('✅ Database seeding completed successfully!');
    console.log(`📊 Created ${projectCount} projects with realistic milestones and evidence`);
    console.log(`👷 Worker: +15555550100 (password: ${WORKER_SEED_PASSWORD})`);
    console.log(`🔍 Reviewer: +15555550200 (password: ${REVIEWER_SEED_PASSWORD})`);
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

