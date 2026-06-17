import { ProjectMemberRole, User } from '@prisma/client';
import { env } from '../config/env';
import { notificationProvider } from '../notifications';
import { NotificationRecipient } from '../notifications/types';
import { projectMemberRepository } from '../repositories/projectMemberRepository';
import { logger, maskPhone } from '../utils/logger';

const readAppUrl = () => {
  const origin = env.CORS_ORIGIN.split(',')[0]?.trim();
  if (!origin) {
    return null;
  }

  return origin.replace(/\/$/, '');
};

const buildNotificationClosing = () => {
  const appUrl = readAppUrl();
  return appUrl
    ? `Open Progress Log: ${appUrl}`
    : 'Open the Progress Log app to view the project.';
};

const buildReviewerAddedBody = (reviewerName: string, actorName: string, projectTitle: string) => {
  const firstName = splitName(reviewerName).firstName;

  return `[PROGRESS LOG] Hello ${firstName}, ${actorName} added you as a reviewer on their project "${projectTitle}". You'll receive SMS updates when milestones are submitted for review. ${buildNotificationClosing()}`;
};

const buildReviewerInvitedBody = (reviewerName: string, actorName: string, projectTitle: string) => {
  const firstName = splitName(reviewerName).firstName;

  return `[PROGRESS LOG] Hello ${firstName}, ${actorName} invited you to review their project "${projectTitle}". You'll receive SMS updates when milestones are submitted for review. ${buildNotificationClosing()}`;
};

const buildMilestoneSubmittedBody = (
  reviewerName: string,
  workerName: string,
  milestoneTitle: string,
  projectTitle: string
) => {
  const firstName = splitName(reviewerName).firstName;

  return `[PROGRESS LOG] Hello ${firstName}, ${workerName} submitted milestone "${milestoneTitle}" for review on project "${projectTitle}". Open Progress Log to review it. ${buildNotificationClosing()}`;
};

const buildMilestoneReviewedBody = (
  workerName: string,
  reviewerName: string,
  milestoneTitle: string,
  projectTitle: string,
  decision: 'approved' | 'needs_revision'
) => {
  const firstName = splitName(workerName).firstName;
  const outcome =
    decision === 'approved'
      ? `${reviewerName} approved your milestone "${milestoneTitle}" on project "${projectTitle}".`
      : `${reviewerName} sent your milestone "${milestoneTitle}" back for revision on project "${projectTitle}".`;

  return `[PROGRESS LOG] Hello ${firstName}, ${outcome} Open Progress Log to view the update. ${buildNotificationClosing()}`;
};

const splitName = (name: string) => {
  const trimmed = name.trim();
  const spaceIndex = trimmed.indexOf(' ');

  if (spaceIndex === -1) {
    return {
      firstName: trimmed,
      lastName: undefined
    };
  }

  return {
    firstName: trimmed.slice(0, spaceIndex),
    lastName: trimmed.slice(spaceIndex + 1).trim() || undefined
  };
};

const toRecipient = (user: Pick<User, 'phone' | 'name' | 'country'>): NotificationRecipient => {
  const { firstName, lastName } = splitName(user.name);

  return {
    phoneNumber: user.phone,
    country: user.country,
    firstName,
    lastName
  };
};

const dispatch = (promise: Promise<void>, event: string, fields: Record<string, unknown> = {}) => {
  void promise.catch((error) => {
    logger.error(event, {
      ...fields,
      message: error instanceof Error ? error.message : 'Unknown notification error'
    });
  });
};

const sendSms = async (recipient: NotificationRecipient, body: string, metadata: Record<string, string>) => {
  await notificationProvider.sendSms({
    recipient,
    body,
    metadata
  });
};

const listProjectReviewers = async (projectId: string) => {
  const members = await projectMemberRepository.listByProject(projectId);
  return members.filter((member) => member.role === ProjectMemberRole.REVIEWER).map((member) => member.user);
};

export const notificationService = {
  notifyReviewersMilestoneSubmitted(input: {
    projectId: string;
    projectTitle: string;
    milestoneId: string;
    milestoneTitle: string;
    workerName: string;
  }) {
    dispatch(
      (async () => {
        const reviewers = await listProjectReviewers(input.projectId);
        if (reviewers.length === 0) {
          logger.info('notification.milestone_submitted.skipped', {
            projectId: input.projectId,
            milestoneId: input.milestoneId,
            reason: 'no_reviewers'
          });
          return;
        }

        await Promise.all(
          reviewers.map((reviewer) =>
            sendSms(
              toRecipient(reviewer),
              buildMilestoneSubmittedBody(
                reviewer.name,
                input.workerName,
                input.milestoneTitle,
                input.projectTitle
              ),
              {
                event: 'milestone_submitted',
                project_id: input.projectId,
                milestone_id: input.milestoneId
              }
            )
          )
        );

        logger.info('notification.milestone_submitted.sent', {
          projectId: input.projectId,
          milestoneId: input.milestoneId,
          recipientCount: reviewers.length
        });
      })(),
      'notification.milestone_submitted.failed',
      {
        projectId: input.projectId,
        milestoneId: input.milestoneId
      }
    );
  },

  notifyWorkerMilestoneReviewed(input: {
    projectId: string;
    projectTitle: string;
    milestoneId: string;
    milestoneTitle: string;
    worker: Pick<User, 'phone' | 'name' | 'country'>;
    reviewerName: string;
    decision: 'approved' | 'needs_revision';
  }) {
    const body = buildMilestoneReviewedBody(
      input.worker.name,
      input.reviewerName,
      input.milestoneTitle,
      input.projectTitle,
      input.decision
    );

    dispatch(
      sendSms(toRecipient(input.worker), body, {
        event: 'milestone_reviewed',
        project_id: input.projectId,
        milestone_id: input.milestoneId,
        decision: input.decision
      }),
      'notification.milestone_reviewed.failed',
      {
        projectId: input.projectId,
        milestoneId: input.milestoneId,
        phone: maskPhone(input.worker.phone)
      }
    );
  },

  notifyReviewerInvited(input: {
    projectId: string;
    projectTitle: string;
    actorName: string;
    reviewer: Pick<User, 'phone' | 'name' | 'country'>;
  }) {
    const body = buildReviewerInvitedBody(input.reviewer.name, input.actorName, input.projectTitle);

    dispatch(
      sendSms(toRecipient(input.reviewer), body, {
        event: 'reviewer_invited',
        project_id: input.projectId
      }),
      'notification.reviewer_invited.failed',
      {
        projectId: input.projectId,
        phone: maskPhone(input.reviewer.phone)
      }
    );
  },

  notifyReviewersProjectCreated(input: {
    projectId: string;
    projectTitle: string;
    actorName: string;
    reviewers: Pick<User, 'phone' | 'name' | 'country'>[];
  }) {
    if (input.reviewers.length === 0) {
      return;
    }

    dispatch(
      (async () => {
        await Promise.all(
          input.reviewers.map((reviewer) =>
            sendSms(
              toRecipient(reviewer),
              buildReviewerAddedBody(reviewer.name, input.actorName, input.projectTitle),
              {
                event: 'reviewer_added',
                project_id: input.projectId
              }
            )
          )
        );

        logger.info('notification.project_created.sent', {
          projectId: input.projectId,
          recipientCount: input.reviewers.length
        });
      })(),
      'notification.project_created.failed',
      {
        projectId: input.projectId
      }
    );
  }
};
