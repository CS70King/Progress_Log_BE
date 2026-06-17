import Surge from '@surgeapi/node';
import { env } from '../config/env';
import { logger, maskPhone } from '../utils/logger';
import { NotificationProvider, SendSmsInput } from './types';

const surgeClient = new Surge({
  apiKey: env.SURGE_API_KEY
});

const buildConversation = (input: SendSmsInput) => {
  const contact: {
    phone_number: string;
    first_name?: string;
    last_name?: string;
  } = {
    phone_number: input.recipient.phoneNumber
  };

  if (input.recipient.firstName) {
    contact.first_name = input.recipient.firstName;
  }

  if (input.recipient.lastName) {
    contact.last_name = input.recipient.lastName;
  }

  const conversation: {
    contact: typeof contact;
    phone_number?: string;
  } = {
    contact
  };

  if (env.SURGE_FROM_PHONE_NUMBER?.trim()) {
    conversation.phone_number = env.SURGE_FROM_PHONE_NUMBER.trim();
  }

  return conversation;
};

export const surgeNotificationProvider: NotificationProvider = {
  async sendSms(input) {
    logger.info('notification.surge.send.start', {
      phone: maskPhone(input.recipient.phoneNumber),
      bodyLength: input.body.length,
      metadata: input.metadata ?? null
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.NOTIFICATION_TIMEOUT_MS);

    try {
      const message = await surgeClient.messages.create(
        env.SURGE_ACCOUNT_ID!,
        {
          body: input.body,
          conversation: buildConversation(input),
          metadata: input.metadata
        },
        {
          signal: controller.signal
        }
      );

      logger.info('notification.surge.send.enqueued', {
        phone: maskPhone(input.recipient.phoneNumber),
        messageId: message.id
      });
    } catch (error) {
      logger.error('notification.surge.send.error', {
        phone: maskPhone(input.recipient.phoneNumber),
        message: error instanceof Error ? error.message : 'Unknown Surge error'
      });
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
};
