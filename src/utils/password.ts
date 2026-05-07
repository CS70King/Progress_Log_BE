import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export const hashPin = async (pin: string) => bcrypt.hash(pin, SALT_ROUNDS);

export const comparePin = async (pin: string, passwordHash: string) => {
  return bcrypt.compare(pin, passwordHash);
};
