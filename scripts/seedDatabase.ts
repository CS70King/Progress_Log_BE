#!/usr/bin/env tsx

import crypto from 'node:crypto';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import {
  EvidenceType,
  MilestoneStatus,
  ProjectMemberRole,
  ProjectState,
  ProjectType,
  ReviewDecision,
  UserRole
} from '@prisma/client';
import { env } from '../src/config/env';
import { prisma } from '../src/db/prisma';
import { ImageService } from '../src/services/imageService';
import { VideoThumbnailService } from '../src/services/videoThumbnailService';
import { createStorageClient, ensureSupabaseBucket } from '../src/storage/supabaseStorage';
import { storage, storageDriver } from '../src/storage';
import { hashPassword } from '../src/utils/password';

const WORKER_SEED_PASSWORD = 'WorkerDemo123!';
const REVIEWER_SEED_PASSWORD = 'ReviewerDemo123!';
const WORKER_PHONE = '+10123456789';
const REVIEWER_PHONE = '+10123456780';

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
  'Complete renovation of a 20-story office building with modern amenities and energy-efficient systems.',
  'Construction of a two-mile highway bridge with pedestrian walkway and bicycle lane.',
  'Development of a 150-unit residential complex with underground parking and community facilities.',
  'Expansion of an existing shopping mall with 50 new retail spaces and a food court.',
  'Modernization of an aging school building with new classrooms and technology infrastructure.',
  'Addition of a new hospital wing with surgical suites and diagnostic facilities.',
  'Construction of a 500,000 square foot warehouse complex with loading docks and office space.',
  'Upgrade of a water treatment facility with new filtration systems and capacity expansion.',
  'New 45,000-seat sports stadium with modern amenities and concession facilities.',
  'Renovation of an airport terminal with expanded security areas and passenger facilities.'
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
  'Complete site clearing, grading, and excavation to required depths.',
  'Pour concrete foundations, footings, and slab work according to structural specifications.',
  'Erect structural steel frame including columns, beams, and bracing systems.',
  'Install exterior walls, windows, and envelope systems.',
  'Complete roofing system installation including waterproofing and insulation.',
  'Install interior partition walls, door frames, and structural components.',
  'Install mechanical, electrical, and plumbing systems throughout the building.',
  'Complete interior finishes including flooring, painting, and fixtures.',
  'Complete exterior landscaping, parking lots, and site improvements.',
  'Conduct final inspections, testing, and commissioning of all systems.'
];

type SeedEvidenceType = (typeof EvidenceType)['PHOTO' | 'VIDEO' | 'DOCUMENT'];
type SeedAsset = {
  evidenceType: SeedEvidenceType;
  buffer: Buffer;
  contentType: 'image/jpeg' | 'video/mp4' | 'application/pdf';
  originalFilename: string;
};
let cachedSeedVideoBuffer: Buffer | null = null;
const seedVideoUrls = [
  'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
  'https://samplelib.com/lib/preview/mp4/sample-5s.mp4'
];

type SeedPlan = {
  projectCount: number;
  minMilestones: number;
  maxMilestones: number;
  minImagesPerMilestone: number;
  maxImagesPerMilestone: number;
};

type SeedRunState = {
  userIds: string[];
  projectIds: string[];
};

type SupportedSeedEnvironment = 'development' | 'staging' | 'production';

const defaultSeedPlans: Record<SupportedSeedEnvironment, SeedPlan> = {
  development: {
    projectCount: 10,
    minMilestones: 5,
    maxMilestones: 15,
    minImagesPerMilestone: 3,
    maxImagesPerMilestone: 20
  },
  staging: {
    projectCount: 5,
    minMilestones: 5,
    maxMilestones: 12,
    minImagesPerMilestone: 3,
    maxImagesPerMilestone: 12
  },
  production: {
    projectCount: 3,
    minMilestones: 4,
    maxMilestones: 10,
    minImagesPerMilestone: 2,
    maxImagesPerMilestone: 8
  }
};

const assertSupportedSeedEnvironment = (): SupportedSeedEnvironment => {
  if (env.NODE_ENV === 'development' || env.NODE_ENV === 'staging' || env.NODE_ENV === 'production') {
    return env.NODE_ENV;
  }

  throw new Error(`Seeding is only supported in development, staging, or production. Current environment: ${env.NODE_ENV}`);
};

const getRandomElement = <T>(array: readonly T[]): T => {
  return array[Math.floor(Math.random() * array.length)];
};

const getRandomInt = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const getRandomDate = (start: Date, end: Date): Date => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

const getSeedPlan = (): SeedPlan => {
  const defaults = defaultSeedPlans[assertSupportedSeedEnvironment()];

  return {
    projectCount: env.SEED_PROJECT_COUNT ?? defaults.projectCount,
    minMilestones: env.SEED_MIN_MILESTONES ?? defaults.minMilestones,
    maxMilestones: env.SEED_MAX_MILESTONES ?? defaults.maxMilestones,
    minImagesPerMilestone: env.SEED_MIN_IMAGES_PER_MILESTONE ?? defaults.minImagesPerMilestone,
    maxImagesPerMilestone: env.SEED_MAX_IMAGES_PER_MILESTONE ?? defaults.maxImagesPerMilestone
  };
};

const promptForConfirmation = async (plan: SeedPlan) => {
  if (env.NODE_ENV !== 'production') {
    return;
  }

  console.log('Starting database seeding for production.');
  console.log('This will add seed data to the current production database.');
  console.log(`Environment: ${env.NODE_ENV}`);
  console.log(`Bucket: ${env.SUPABASE_STORAGE_BUCKET}`);
  console.log(`Projects to create: ${plan.projectCount}`);
  console.log('Production seeding should only be used when you intentionally want the demo dataset.');
  console.log('Type "SEED PRODUCTION" to continue.');

  const rl = readline.createInterface({ input, output });
  try {
    const confirmation = (await rl.question('Confirmation: ')).trim();
    if (confirmation !== 'SEED PRODUCTION') {
      throw new Error('Seed cancelled by user.');
    }
  } finally {
    rl.close();
  }
};

const ensureStorageReady = async () => {
  if (storageDriver !== 'supabase') {
    console.log(`Storage driver is ${storageDriver}; seed files will not be persisted to Supabase.`);
    return;
  }

  await ensureSupabaseBucket(createStorageClient(), env.SUPABASE_STORAGE_BUCKET, {
    allowCreate: env.NODE_ENV !== 'production'
  });
};

const findExistingSeedUsers = async () => {
  return prisma.user.findMany({
    where: {
      phone: {
        in: [WORKER_PHONE, REVIEWER_PHONE]
      }
    },
    select: {
      id: true,
      phone: true,
      role: true,
      name: true
    }
  });
};

const downloadSeedImage = async (projectIndex: number, milestoneIndex: number, evidenceIndex: number) => {
  const imageUrl = `https://picsum.photos/seed/progress-log-${projectIndex}-${milestoneIndex}-${evidenceIndex}/800/600.jpg`;
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download seed image from ${imageUrl}. HTTP ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
};

const downloadSeedVideo = async () => {
  if (cachedSeedVideoBuffer) {
    return cachedSeedVideoBuffer;
  }

  let lastError: unknown;
  for (const videoUrl of seedVideoUrls) {
    try {
      const response = await fetch(videoUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      cachedSeedVideoBuffer = Buffer.from(await response.arrayBuffer());
      return cachedSeedVideoBuffer;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `Failed to download a seed video from the configured sources: ${lastError instanceof Error ? lastError.message : 'Unknown error'}`
  );
};

const escapePdfText = (value: string) => value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

const buildSeedPdf = (title: string, projectIndex: number, milestoneIndex: number, evidenceIndex: number) => {
  const lines = [
    `Progress Log File`,
    `Title: ${title}`,
    `Project Index: ${projectIndex + 1}`,
    `Milestone Index: ${milestoneIndex + 1}`,
    `Evidence Index: ${evidenceIndex + 1}`
  ];
  const textCommands = lines
    .map((line, index) => `BT /F1 16 Tf 50 ${760 - index * 28} Td (${escapePdfText(line)}) Tj ET`)
    .join('\n');

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj',
    `4 0 obj\n<< /Length ${Buffer.byteLength(textCommands, 'utf8')} >>\nstream\n${textCommands}\nendstream\nendobj`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj'
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${object}\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${offsets[index].toString().padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, 'utf8');
};

const createSeedAsset = async (input: {
  projectIndex: number;
  milestoneIndex: number;
  evidenceIndex: number;
  evidenceType: SeedEvidenceType;
}) => {
  if (input.evidenceType === EvidenceType.PHOTO) {
    return {
      evidenceType: input.evidenceType,
      buffer: await downloadSeedImage(input.projectIndex, input.milestoneIndex, input.evidenceIndex),
      contentType: 'image/jpeg',
      originalFilename: `photo-${input.evidenceIndex + 1}.jpg`
    } satisfies SeedAsset;
  }

  if (input.evidenceType === EvidenceType.VIDEO) {
    return {
      evidenceType: input.evidenceType,
      buffer: await downloadSeedVideo(),
      contentType: 'video/mp4',
      originalFilename: `video-${input.evidenceIndex + 1}.mp4`
    } satisfies SeedAsset;
  }

  return {
    evidenceType: input.evidenceType,
    buffer: buildSeedPdf(
      `Milestone file ${input.evidenceIndex + 1}`,
      input.projectIndex,
      input.milestoneIndex,
      input.evidenceIndex
    ),
    contentType: 'application/pdf',
    originalFilename: `file-${input.evidenceIndex + 1}.pdf`
  } satisfies SeedAsset;
};

const buildEvidencePlan = (count: number) => {
  const planned: SeedEvidenceType[] = [EvidenceType.PHOTO];

  if (count >= 2) {
    planned.push(EvidenceType.VIDEO);
  }

  if (count >= 3) {
    planned.push(EvidenceType.DOCUMENT);
  }

  while (planned.length < count) {
    planned.push(
      getRandomElement([
        EvidenceType.PHOTO,
        EvidenceType.PHOTO,
        EvidenceType.PHOTO,
        EvidenceType.VIDEO,
        EvidenceType.DOCUMENT
      ])
    );
  }

  return planned.sort(() => Math.random() - 0.5);
};

const createSeedEvidence = async (input: {
  projectId: string;
  milestoneId: string;
  workerId: string;
  evidenceIndex: number;
  projectIndex: number;
  milestoneIndex: number;
  evidenceType: SeedEvidenceType;
}) => {
  const asset = await createSeedAsset(input);

  const evidenceId = crypto.randomUUID();
  const baseName = asset.originalFilename;
  const filePath = `projects/${input.projectId}/milestones/${input.milestoneId}/${evidenceId}-${baseName}`;
  const thumbnailPath =
    asset.contentType.startsWith('image/') || asset.contentType.startsWith('video/')
      ? ImageService.getThumbnailPath(filePath)
      : undefined;
  let width: number | undefined;
  let height: number | undefined;
  let thumbnailSize: bigint | undefined;
  let thumbnailWidth: number | undefined;
  let thumbnailHeight: number | undefined;
  let thumbnailBuffer: Buffer | undefined;

  if (asset.contentType.startsWith('image/')) {
    const metadata = await ImageService.extractMetadata(asset.buffer);
    const thumbnail = await ImageService.generateThumbnail(asset.buffer);
    width = metadata.width;
    height = metadata.height;
    thumbnailBuffer = thumbnail.buffer;
    thumbnailSize = BigInt(thumbnail.size);
    thumbnailWidth = thumbnail.width;
    thumbnailHeight = thumbnail.height;
  } else if (asset.contentType.startsWith('video/')) {
    const videoThumbnail = await VideoThumbnailService.generateThumbnail(asset.buffer, {
      contentType: asset.contentType,
      originalFilename: asset.originalFilename
    });
    width = videoThumbnail.width;
    height = videoThumbnail.height;
    thumbnailBuffer = videoThumbnail.thumbnail.buffer;
    thumbnailSize = BigInt(videoThumbnail.thumbnail.size);
    thumbnailWidth = videoThumbnail.thumbnail.width;
    thumbnailHeight = videoThumbnail.thumbnail.height;
  }

  await storage.uploadEvidenceFile(env.SUPABASE_STORAGE_BUCKET, filePath, asset.buffer, asset.contentType);

  try {
    if (thumbnailPath && thumbnailBuffer) {
      await storage.uploadEvidenceFile(env.SUPABASE_STORAGE_BUCKET, thumbnailPath, thumbnailBuffer, 'image/jpeg');
    }

    return await prisma.evidenceItem.create({
      data: {
        id: evidenceId,
        projectId: input.projectId,
        milestoneId: input.milestoneId,
        uploadedBy: input.workerId,
        evidenceType: input.evidenceType,
        originalFilename: baseName,
        filePath,
        contentType: asset.contentType,
        sizeBytes: BigInt(asset.buffer.length),
        ...(width !== undefined ? { width } : {}),
        ...(height !== undefined ? { height } : {}),
        ...(thumbnailPath ? { thumbnailPath } : {}),
        ...(thumbnailSize !== undefined ? { thumbnailSize } : {}),
        ...(thumbnailWidth !== undefined ? { thumbnailWidth } : {}),
        ...(thumbnailHeight !== undefined ? { thumbnailHeight } : {})
      }
    });
  } catch (error) {
    if (thumbnailPath) {
      await storage.deleteEvidenceFile(env.SUPABASE_STORAGE_BUCKET, thumbnailPath).catch(() => undefined);
    }
    await storage.deleteEvidenceFile(env.SUPABASE_STORAGE_BUCKET, filePath).catch(() => undefined);
    throw error;
  }
};

const createWorker = async () => {
  const passwordHash = await hashPassword(WORKER_SEED_PASSWORD);

  return prisma.user.create({
    data: {
      name: 'John Construction Manager',
      phone: WORKER_PHONE,
      country: 'United States',
      company: 'BuildRight Construction',
      role: UserRole.WORKER,
      passwordHash
    }
  });
};

const createReviewer = async () => {
  const passwordHash = await hashPassword(REVIEWER_SEED_PASSWORD);

  return prisma.user.create({
    data: {
      name: 'Sarah Quality Inspector',
      phone: REVIEWER_PHONE,
      country: 'United States',
      company: 'Quality Assurance Partners',
      role: UserRole.REVIEWER,
      passwordHash
    }
  });
};

const createProjectWithMilestones = async (
  workerId: string,
  reviewerId: string,
  projectIndex: number,
  plan: SeedPlan,
  state: SeedRunState
) => {
  const projectType = getRandomElement([ProjectType.GENERIC, ProjectType.CONSTRUCTION, ProjectType.SERVICE]);
  const projectState = getRandomElement([ProjectState.ACTIVE, ProjectState.COMPLETED, ProjectState.ABANDONED]);

  const project = await prisma.project.create({
    data: {
      title: projectTitles[projectIndex % projectTitles.length],
      description: projectDescriptions[projectIndex % projectDescriptions.length],
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
  state.projectIds.push(project.id);

  const milestoneCount = getRandomInt(plan.minMilestones, plan.maxMilestones);

  for (let milestoneIndex = 0; milestoneIndex < milestoneCount; milestoneIndex += 1) {
    let status: MilestoneStatus;
    if (projectState === ProjectState.COMPLETED) {
      status = MilestoneStatus.APPROVED;
    } else if (projectState === ProjectState.ABANDONED) {
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
        title: milestoneTitles[milestoneIndex % milestoneTitles.length],
        description: milestoneDescriptions[milestoneIndex % milestoneDescriptions.length],
        activityDate: getRandomDate(new Date(2024, 0, 1), new Date(2024, 11, 31)),
        status,
        projectId: project.id,
        createdBy: workerId
      }
    });

    const evidenceCount = getRandomInt(plan.minImagesPerMilestone, plan.maxImagesPerMilestone);
    const evidencePlan = buildEvidencePlan(evidenceCount);
    for (let evidenceIndex = 0; evidenceIndex < evidencePlan.length; evidenceIndex += 1) {
      const evidenceType = evidencePlan[evidenceIndex];
      await createSeedEvidence({
        projectId: project.id,
        milestoneId: milestone.id,
        workerId,
        evidenceIndex,
        projectIndex,
        milestoneIndex,
        evidenceType
      });
    }

    if (status === MilestoneStatus.APPROVED || status === MilestoneStatus.NEEDS_REVISION) {
      await prisma.milestoneReview.create({
        data: {
          milestoneId: milestone.id,
          reviewerId,
          decision: status === MilestoneStatus.APPROVED ? ReviewDecision.APPROVED : ReviewDecision.NEEDS_REVISION,
          note:
            status === MilestoneStatus.APPROVED
              ? 'Work meets quality standards and is approved for the next phase.'
              : 'Minor issues identified. Please address the noted items before resubmission.'
        }
      });
    }
  }
};

const rollbackSeedRun = async (state: SeedRunState) => {
  if (!state.userIds.length && !state.projectIds.length) {
    return;
  }

  console.warn('Seed failed. Rolling back seeded data from this run...');

  const rollbackProjectIds = [...new Set(state.projectIds)];
  const rollbackUserIds = [...new Set(state.userIds)];

  if (rollbackProjectIds.length > 0) {
    const milestones = await prisma.milestone.findMany({
      where: {
        projectId: {
          in: rollbackProjectIds
        }
      },
      select: {
        id: true
      }
    });

    const milestoneIds = milestones.map((milestone) => milestone.id);

    if (milestoneIds.length > 0) {
      const storedEvidence = await prisma.evidenceItem.findMany({
        where: {
          milestoneId: {
            in: milestoneIds
          }
        },
        select: {
          filePath: true,
          thumbnailPath: true
        }
      });

      for (const item of storedEvidence) {
        await storage.deleteEvidenceFile(env.SUPABASE_STORAGE_BUCKET, item.filePath).catch((error) => {
          console.warn(
            `Rollback warning: failed to delete storage object ${item.filePath}: ${error instanceof Error ? error.message : String(error)}`
          );
        });

        if (item.thumbnailPath) {
          await storage.deleteEvidenceFile(env.SUPABASE_STORAGE_BUCKET, item.thumbnailPath).catch((error) => {
            console.warn(
              `Rollback warning: failed to delete thumbnail ${item.thumbnailPath}: ${error instanceof Error ? error.message : String(error)}`
            );
          });
        }
      }

      await prisma.milestoneReview.deleteMany({
        where: {
          milestoneId: {
            in: milestoneIds
          }
        }
      });

      await prisma.evidenceItem.deleteMany({
        where: {
          milestoneId: {
            in: milestoneIds
          }
        }
      });

      await prisma.milestone.deleteMany({
        where: {
          id: {
            in: milestoneIds
          }
        }
      });
    }

    await prisma.projectMember.deleteMany({
      where: {
        projectId: {
          in: rollbackProjectIds
        }
      }
    });

    await prisma.project.deleteMany({
      where: {
        id: {
          in: rollbackProjectIds
        }
      }
    });
  }

  if (rollbackUserIds.length > 0) {
    await prisma.user.deleteMany({
      where: {
        id: {
          in: rollbackUserIds
        }
      }
    });
  }

  console.warn('Rollback completed.');
};

async function main() {
  const plan = getSeedPlan();
  const seedRunState: SeedRunState = {
    userIds: [],
    projectIds: []
  };

  try {
    const existingSeedUsers = await findExistingSeedUsers();
    if (existingSeedUsers.length > 0) {
      console.log('Seed users already exist. Skipping seed to avoid duplicate demo data.');
      for (const user of existingSeedUsers) {
        console.log(`- ${user.phone} (${user.role.toLowerCase()}) ${user.name}`);
      }
      console.log('Use the appropriate wipe script first if you want to reseed from scratch.');
      return;
    }

    await promptForConfirmation(plan);
    await ensureStorageReady();

    console.log('Creating worker...');
    const worker = await createWorker();
    seedRunState.userIds.push(worker.id);

    console.log('Creating reviewer...');
    const reviewer = await createReviewer();
    seedRunState.userIds.push(reviewer.id);

    console.log(`Creating ${plan.projectCount} projects...`);
    for (let projectIndex = 0; projectIndex < plan.projectCount; projectIndex += 1) {
      console.log(`  Creating project ${projectIndex + 1}/${plan.projectCount}: ${projectTitles[projectIndex % projectTitles.length]}`);
      await createProjectWithMilestones(worker.id, reviewer.id, projectIndex, plan, seedRunState);
    }

    console.log('Database seeding completed successfully.');
    console.log(`Worker credentials: ${WORKER_PHONE} / ${WORKER_SEED_PASSWORD}`);
    console.log(`Reviewer credentials: ${REVIEWER_PHONE} / ${REVIEWER_SEED_PASSWORD}`);
  } catch (error) {
    console.error('Error seeding database:', error);
    try {
      await rollbackSeedRun(seedRunState);
    } catch (rollbackError) {
      console.error('Seed rollback failed:', rollbackError);
    }
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}
