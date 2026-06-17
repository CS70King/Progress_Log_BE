import { logger, maskPhone } from '../utils/logger';
import { resolveNotificationRegion } from './resolveNotificationRegion';
import { NotificationProvider } from './types';

export const mockNotificationProvider: NotificationProvider = {
  async sendSms(input) {
    const region = resolveNotificationRegion({
      phoneNumber: input.recipient.phoneNumber,
      country: input.recipient.country
    });

    logger.info('notification.mock.sent', {
      phone: maskPhone(input.recipient.phoneNumber),
      country: input.recipient.country ?? null,
      region,
      bodyLength: input.body.length,
      metadata: input.metadata ?? null
    });
  }
};
