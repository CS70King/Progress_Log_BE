import { env } from '../config/env';
import { mockNotificationProvider } from './mockNotificationProvider';
import { routingNotificationProvider } from './routingNotificationProvider';
import { NotificationProvider } from './types';

const offNotificationProvider: NotificationProvider = {
  async sendSms() {
    return;
  }
};

const usesRegionalRouting = env.NOTIFICATION_DRIVER === 'on';

const providers: Record<typeof env.NOTIFICATION_DRIVER, NotificationProvider> = {
  off: offNotificationProvider,
  mock: mockNotificationProvider,
  on: routingNotificationProvider
};

export const notificationDriver = env.NOTIFICATION_DRIVER;
export const notificationProvider = providers[notificationDriver];
export const notificationUsesRegionalRouting = usesRegionalRouting;
