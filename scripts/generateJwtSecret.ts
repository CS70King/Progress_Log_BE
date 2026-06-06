#!/usr/bin/env tsx

import crypto from 'node:crypto';

const secret = crypto.randomBytes(48).toString('base64url');

console.log('Generated JWT secret:');
console.log(secret);
console.log('');
console.log('Use it as:');
console.log(`JWT_SECRET=${secret}`);
