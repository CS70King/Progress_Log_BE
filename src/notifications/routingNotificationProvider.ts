import { logger, maskPhone } from '../utils/logger';
import { arkeselNotificationProvider } from './arkeselNotificationProvider';
import { isDevNotificationRecipientAllowed } from './devNotificationAllowlist';
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
      if (!isDevNotificationRecipientAllowed(input.recipient.phoneNumber, region)) {
        logger.info('notification.dev_allowlist.skipped', {
          region,
          phone: maskPhone(input.recipient.phoneNumber),
          country: input.recipient.country ?? null,
          event: input.metadata?.event ?? null
        });
        return;
      }

      await surgeNotificationProvider.sendSms(input);
      return;
    }

    if (region === 'ghana') {
      if (!isDevNotificationRecipientAllowed(input.recipient.phoneNumber, region)) {
        logger.info('notification.dev_allowlist.skipped', {
          region,
          phone: maskPhone(input.recipient.phoneNumber),
          country: input.recipient.country ?? null,
          event: input.metadata?.event ?? null
        });
        return;
      }

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
