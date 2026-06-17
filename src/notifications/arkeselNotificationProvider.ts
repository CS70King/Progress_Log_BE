import { logger, maskPhone } from '../utils/logger';
import { NotificationProvider } from './types';

export const arkeselNotificationProvider: NotificationProvider = {
  async sendSms(input) {
    logger.info('notification.arkesel.stub', {
      phone: maskPhone(input.recipient.phoneNumber),
      country: input.recipient.country ?? null,
      bodyLength: input.body.length,
      metadata: input.metadata ?? null,
      reason: 'Arkesel provider is not implemented yet'
    });
  }
};
