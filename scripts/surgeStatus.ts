#!/usr/bin/env tsx

import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

const envPath = path.resolve(process.cwd(), process.env.ENV_FILE || '.env.development');
const envFile = dotenv.parse(fs.readFileSync(envPath, 'utf8'));

const apiKey = envFile.SURGE_API_KEY?.trim();
const accountId = envFile.SURGE_ACCOUNT_ID?.trim();
const fromPhone = envFile.SURGE_FROM_PHONE_NUMBER?.trim();
const driver = envFile.NOTIFICATION_DRIVER?.trim() || 'off';

async function main() {
  console.log('NOTIFICATION_DRIVER:', driver);
  console.log('SURGE_API_KEY set:', Boolean(apiKey));
  console.log('SURGE_ACCOUNT_ID set:', Boolean(accountId));
  console.log('SURGE_FROM_PHONE_NUMBER set:', Boolean(fromPhone));

  if (!apiKey) {
    console.log('\nMISSING: SURGE_API_KEY is empty in .env.development');
    return;
  }

  const response = await fetch('https://api.surge.app/accounts', {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json'
    }
  });

  const bodyText = await response.text();
  let body: { data?: Array<{ id: string; name?: string | null }>; error?: { message?: string; type?: string } } | null =
    null;

  try {
    body = JSON.parse(bodyText) as typeof body;
  } catch {
    body = null;
  }

  console.log('\nGET /accounts status:', response.status);

  if (!response.ok) {
    console.log('API error:', body?.error?.type ?? 'unknown', '-', body?.error?.message ?? bodyText.slice(0, 200));
    console.log('\nMISSING or INVALID: Surge API key does not authenticate successfully.');
    return;
  }

  const accounts = body?.data ?? [];
  console.log('Accounts returned:', accounts.length);

  if (accounts.length === 0) {
    console.log('\nMISSING: No Surge messaging account exists yet.');
    console.log('You have a valid API key, but Surge has zero accounts under it.');
    console.log('Create one in the Surge dashboard or via POST https://api.surge.app/accounts');
    console.log('That creation step produces the acct_... value for SURGE_ACCOUNT_ID.');
    return;
  }

  for (const account of accounts) {
    console.log('-', account.id, account.name ? `(${account.name})` : '');
  }

  if (!accountId) {
    console.log('\nMISSING: SURGE_ACCOUNT_ID is empty.');
    console.log('Use one of the account ids listed above.');
    return;
  }

  const matched = accounts.some((account) => account.id === accountId);
  if (!matched) {
    console.log('\nINVALID: SURGE_ACCOUNT_ID does not match any account returned by Surge.');
    return;
  }

  const phoneResponse = await fetch(`https://api.surge.app/accounts/${accountId}/phone_numbers`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json'
    }
  });

  const phoneBodyText = await phoneResponse.text();
  let phoneBody: { data?: Array<{ number?: string }> } | null = null;

  try {
    phoneBody = JSON.parse(phoneBodyText) as typeof phoneBody;
  } catch {
    phoneBody = null;
  }

  console.log('\nGET /phone_numbers status:', phoneResponse.status);
  const phoneNumbers = phoneBody?.data ?? [];
  console.log('Phone numbers on account:', phoneNumbers.length);

  if (phoneNumbers.length === 0) {
    console.log('\nMISSING: No sending phone number on this Surge account.');
    console.log('Purchase a number in Surge, then set SURGE_FROM_PHONE_NUMBER to its E.164 value.');
    return;
  }

  for (const phone of phoneNumbers) {
    console.log('-', phone.number ?? '(unknown number)');
  }

  if (!fromPhone) {
    console.log('\nOPTIONAL MISSING: SURGE_FROM_PHONE_NUMBER is empty.');
    console.log('Surge may use a default if the account has one; otherwise set one of the numbers above.');
    return;
  }

  const phoneMatched = phoneNumbers.some((phone) => phone.number === fromPhone);
  if (!phoneMatched) {
    console.log('\nWARNING: SURGE_FROM_PHONE_NUMBER does not match any number Surge returned for this account.');
    return;
  }

  console.log('\nSurge credentials look structurally complete for sending.');
  console.log('If SMS still fails, campaign/carrier registration may still be pending in Surge.');
}

main().catch((error) => {
  console.error('Diagnostic failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
