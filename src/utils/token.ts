import crypto from 'crypto';

export const generateShareToken = () => crypto.randomBytes(24).toString('hex');
