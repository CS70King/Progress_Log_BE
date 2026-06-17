import { env } from '../config/env';
import { logger, maskPhone } from '../utils/logger';
import { NotificationProvider } from './types';

const ARKESEL_SMS_URL = 'https://sms.arkesel.com/api/v2/sms/send';

type ArkeselSendResponse = {
  status?: string;
  message?: string;
  data?: Array<{
    recipient?: string;
    id?: string;
  }>;
};

const normalizeGhanaRecipient = (phoneNumber: string) => {
  const normalized = phoneNumber.replace(/[\s()-]/g, '');

  if (normalized.startsWith('+233')) {
    return normalized.slice(1);
  }

  if (normalized.startsWith('233')) {
    return normalized;
  }

  return normalized.replace(/^\+/, '');
};

export const arkeselNotificationProvider: NotificationProvider = {
  async sendSms(input) {
    logger.info('notification.arkesel.send.start', {
      phone: maskPhone(input.recipient.phoneNumber),
      bodyLength: input.body.length,
      metadata: input.metadata ?? null
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.NOTIFICATION_TIMEOUT_MS);

    try {
      const response = await fetch(ARKESEL_SMS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': env.ARKESEL_API_KEY!
        },
        body: JSON.stringify({
          sender: env.ARKESEL_SENDER_ID!.trim(),
          message: input.body,
          recipients: [normalizeGhanaRecipient(input.recipient.phoneNumber)]
        }),
        signal: controller.signal
      });

      const payload = (await response.json().catch(() => null)) as ArkeselSendResponse | null;

      if (!response.ok) {
        throw new Error(
          payload?.message ||
            `Arkesel SMS request failed with HTTP ${response.status}`
        );
      }

      if (payload?.status !== 'success') {
        throw new Error(payload?.message || 'Arkesel SMS request did not return success');
      }

      logger.info('notification.arkesel.send.enqueued', {
        phone: maskPhone(input.recipient.phoneNumber),
        messageId: payload.data?.[0]?.id ?? null
      });
    } catch (error) {
      const message =
        error instanceof Error && error.name === 'AbortError'
          ? `Arkesel request timed out after ${env.NOTIFICATION_TIMEOUT_MS}ms`
          : error instanceof Error
            ? error.message
            : 'Unknown Arkesel error';

      logger.error('notification.arkesel.send.error', {
        phone: maskPhone(input.recipient.phoneNumber),
        message
      });
      throw new Error(message);
    } finally {
      clearTimeout(timeout);
    }
  }
};
