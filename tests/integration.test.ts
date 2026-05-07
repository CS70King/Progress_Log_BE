import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { app } from '../src/app';
import { env } from '../src/config/env';

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL
});

const prisma = new PrismaClient({ adapter });

const fixture = (name: string) => path.join(process.cwd(), 'tests', 'fixtures', name);

const truncateAll = async () => {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "share_links",
      "snapshots",
      "evidence_items",
      "milestone_reviews",
      "milestones",
      "project_members",
      "projects",
      "users"
    RESTART IDENTITY CASCADE;
  `);
};

test.beforeEach(async () => {
  await truncateAll();
});

test.after(async () => {
  await prisma.$disconnect();
});

test('supports the Progress Log MVP flow', async () => {
  const workerSignup = await request(app).post('/auth/signup').send({
    name: 'Worker One',
    phone: '+15555550100',
    role: 'worker',
    pin: '1234',
    country: 'United States',
    company: 'Build Co'
  });

  assert.equal(workerSignup.status, 201);
  const workerToken = workerSignup.body.data.token as string;

  const reviewerSignup = await request(app).post('/auth/signup').send({
    name: 'Reviewer One',
    phone: '+15555550200',
    role: 'reviewer',
    pin: '1234',
    country: 'United States',
    company: 'Review Co'
  });

  assert.equal(reviewerSignup.status, 201);
  const reviewerToken = reviewerSignup.body.data.token as string;

  const secondReviewerSignup = await request(app).post('/auth/signup').send({
    name: 'Reviewer Two',
    phone: '+15555550201',
    role: 'reviewer',
    pin: '1234',
    country: 'United States',
    company: 'Review Co'
  });

  assert.equal(secondReviewerSignup.status, 201);

  const projectResponse = await request(app)
    .post('/projects')
    .set('Authorization', `Bearer ${workerToken}`)
    .send({
      title: 'Demo Project',
      description: 'Backend integration test',
      project_type: 'construction',
      reviewer_phones: ['+15555550200', '+15555550201']
    });

  assert.equal(projectResponse.status, 201);
  assert.equal(projectResponse.body.data.reviewers.length, 2);
  const projectId = projectResponse.body.data.id as string;

  const duplicateProjectResponse = await request(app)
    .post('/projects')
    .set('Authorization', `Bearer ${workerToken}`)
    .send({
      title: 'Demo Project',
      description: 'Same worker and reviewer set',
      project_type: 'construction',
      reviewer_phones: ['+15555550201', '+15555550200']
    });

  assert.equal(duplicateProjectResponse.status, 409);

  const milestoneResponse = await request(app)
    .post(`/projects/${projectId}/milestones`)
    .set('Authorization', `Bearer ${workerToken}`)
    .send({
      title: 'Foundation',
      description: 'Foundation completed',
      activity_date: '2026-03-20'
    });

  assert.equal(milestoneResponse.status, 201);
  const milestoneId = milestoneResponse.body.data.id as string;

  const uploadResponse = await request(app)
    .post(`/milestones/${milestoneId}/evidence`)
    .set('Authorization', `Bearer ${workerToken}`)
    .field('evidence_type', 'photo')
    .attach('files', fixture('photo-1.jpg'))
    .attach('files', fixture('photo-2.jpg'));

  assert.equal(uploadResponse.status, 201);
  assert.equal(uploadResponse.body.data.length, 2);

  const submitResponse = await request(app)
    .post(`/milestones/${milestoneId}/submit`)
    .set('Authorization', `Bearer ${workerToken}`);

  assert.equal(submitResponse.status, 200);
  assert.equal(submitResponse.body.data.status, 'submitted');

  const reviewResponse = await request(app)
    .post(`/milestones/${milestoneId}/review`)
    .set('Authorization', `Bearer ${reviewerToken}`)
    .send({
      decision: 'approved'
    });

  assert.equal(reviewResponse.status, 200);
  assert.equal(reviewResponse.body.data.milestone.status, 'approved');

  const dossierResponse = await request(app)
    .get(`/projects/${projectId}/dossier`)
    .set('Authorization', `Bearer ${workerToken}`);

  assert.equal(dossierResponse.status, 200);
  assert.equal(dossierResponse.body.data.header.type, 'project');
  assert.equal(dossierResponse.body.data.milestones.length, 1);
  assert.equal(dossierResponse.body.data.milestones[0].evidence.length, 2);
  assert.ok(dossierResponse.body.data.milestones[0].evidence[0].file_url);

  const snapshotResponse = await request(app)
    .post(`/projects/${projectId}/snapshots`)
    .set('Authorization', `Bearer ${workerToken}`)
    .send({
      title: 'Approved snapshot'
    });

  assert.equal(snapshotResponse.status, 201);
  const snapshotId = snapshotResponse.body.data.id as string;

  const shareResponse = await request(app)
    .post(`/snapshots/${snapshotId}/share`)
    .set('Authorization', `Bearer ${workerToken}`);

  assert.equal(shareResponse.status, 201);
  const shareToken = shareResponse.body.data.token as string;

  const sharedDossierResponse = await request(app).get(`/share/${shareToken}/dossier`);

  assert.equal(sharedDossierResponse.status, 200);
  assert.equal(sharedDossierResponse.body.data.header.type, 'snapshot');
  assert.equal(sharedDossierResponse.body.data.milestones[0].evidence.length, 2);
  assert.match(sharedDossierResponse.body.data.milestones[0].evidence[0].file_url, /mock-storage|supabase/i);
});
