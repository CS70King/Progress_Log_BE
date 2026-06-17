import { logger, maskPhone } from '../utils/logger';
import { arkeselNotificationProvider } from './arkeselNotificationProvider';
import { resolveNotificationRegion } from './resolveNotificationRegion';
import { surgeNotificationProvider } from './surgeNotificationProvider';
import { NotificationProvider } from './types';

export const routingNotificationProvider: NotificationProvider = {
  async sendSms(input) {
    const region = resolveNotificationRegion({
      phoneNumber: input.recipient.phoneNumber,
      country: input.recipient.country
    });

    logger.info('notification.route.selected', {
      region,
      phone: maskPhone(input.recipient.phoneNumber),
      country: input.recipient.country ?? null,
      event: input.metadata?.event ?? null
    });

    if (region === 'usa') {
      await surgeNotificationProvider.sendSms(input);
      return;
    }

    if (region === 'ghana') {
      await arkeselNotificationProvider.sendSms(input);
      return;
    }

    logger.warn('notification.route.skipped', {
      region,
      phone: maskPhone(input.recipient.phoneNumber),
      country: input.recipient.country ?? null,
      reason: 'unsupported_recipient_region'
    });
  }
};
