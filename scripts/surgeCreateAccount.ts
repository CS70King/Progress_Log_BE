#!/usr/bin/env tsx

import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import Surge from '@surgeapi/node';

const envPath = path.resolve(process.cwd(), process.env.ENV_FILE || '.env.development');
const envFile = dotenv.parse(fs.readFileSync(envPath, 'utf8'));
const apiKey = envFile.SURGE_API_KEY?.trim();

if (!apiKey) {
  console.error('SURGE_API_KEY is missing in', envPath);
  process.exit(1);
}

const client = new Surge({ apiKey });

async function main() {
  for await (const existing of client.accounts.list()) {
    console.log('EXISTING_ACCOUNT_ID=' + existing.id);
    return;
  }

  const account = await client.accounts.create({
    name: 'Progress Log'
  });

  console.log('CREATED_ACCOUNT_ID=' + account.id);
}

main().catch((error) => {
  console.error('Failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
