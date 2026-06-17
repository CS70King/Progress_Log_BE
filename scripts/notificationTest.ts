#!/usr/bin/env tsx

import { env } from '../src/config/env';
import { notificationDriver, notificationProvider } from '../src/notifications';

async function main() {
  if (notificationDriver !== 'surge') {
    console.log(`Notification driver is ${notificationDriver}. Set NOTIFICATION_DRIVER=surge to verify Surge delivery.`);
    process.exit(0);
  }

  const testPhone = process.argv[2];
  if (!testPhone) {
    console.error('Usage: npm run notification:test -- +15555550100');
    process.exit(1);
  }

  await notificationProvider.sendSms({
    recipient: {
      phoneNumber: testPhone,
      firstName: 'Progress',
      lastName: 'Log'
    },
    body: 'Progress Log: Surge notification setup verification.',
    metadata: {
      event: 'setup_test'
    }
  });

  console.log('Notification verification passed.');
  console.log(`Account: ${env.SURGE_ACCOUNT_ID}`);
  console.log(`Recipient: ${testPhone}`);
}

main().catch((error) => {
  console.error('Notification verification failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
