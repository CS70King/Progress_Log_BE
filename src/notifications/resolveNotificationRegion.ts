export type NotificationRegion = 'usa' | 'ghana' | 'unsupported';

const normalizePhone = (phoneNumber: string) => phoneNumber.replace(/[\s()-]/g, '');

const normalizeCountry = (country?: string | null) => country?.trim().toLowerCase() ?? '';

const isUsaCountry = (country: string) =>
  country === 'united states' || country === 'usa' || country === 'us' || country === 'u.s.' || country === 'u.s.a.';

const isGhanaCountry = (country: string) => country === 'ghana' || country === 'gh';

const isUsaPhone = (phoneNumber: string) => {
  const normalized = normalizePhone(phoneNumber);

  if (normalized.startsWith('+1')) {
    return normalized.length >= 12;
  }

  return normalized.startsWith('1') && normalized.length === 11;
};

const isGhanaPhone = (phoneNumber: string) => {
  const normalized = normalizePhone(phoneNumber);

  if (normalized.startsWith('+233')) {
    return normalized.length >= 13;
  }

  return normalized.startsWith('233') && normalized.length >= 12;
};

export const resolveNotificationRegion = (input: {
  phoneNumber: string;
  country?: string | null;
}): NotificationRegion => {
  if (isUsaPhone(input.phoneNumber)) {
    return 'usa';
  }

  if (isGhanaPhone(input.phoneNumber)) {
    return 'ghana';
  }

  const country = normalizeCountry(input.country);

  if (isUsaCountry(country)) {
    return 'usa';
  }

  if (isGhanaCountry(country)) {
    return 'ghana';
  }

  return 'unsupported';
};
