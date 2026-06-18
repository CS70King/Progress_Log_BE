import { env } from '../config/env';

const normalizePhoneDigits = (phoneNumber: string) => phoneNumber.replace(/\D/g, '');

export const devNotificationAllowlistEnabled =
  env.NODE_ENV === 'development' && env.NOTIFICATION_DRIVER === 'on';

const phoneMatches = (phoneNumber: string, allowedPhone?: string) => {
  if (!allowedPhone?.trim()) {
    return false;
  }

  return normalizePhoneDigits(phoneNumber) === normalizePhoneDigits(allowedPhone);
};

export const isDevNotificationRecipientAllowed = (
  phoneNumber: string,
  region: 'usa' | 'ghana'
): boolean => {
  if (!devNotificationAllowlistEnabled) {
    return true;
  }

  if (region === 'usa') {
    return phoneMatches(phoneNumber, env.DEV_NOTIFICATION_USA_PHONE);
  }

  return phoneMatches(phoneNumber, env.DEV_NOTIFICATION_GHANA_PHONE);
};
