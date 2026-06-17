#!/usr/bin/env tsx

import { env } from '../src/config/env';
import { notificationDriver, notificationProvider, notificationUsesRegionalRouting } from '../src/notifications';
import { resolveNotificationRegion } from '../src/notifications/resolveNotificationRegion';

async function main() {
  if (!notificationUsesRegionalRouting) {
    console.log(
      `Notification driver is ${notificationDriver}. Set NOTIFICATION_DRIVER=on to verify SMS delivery.`
    );
    process.exit(0);
  }

  const testPhone = process.argv[2];
  if (!testPhone) {
    console.error('Usage: npm run notification:test -- +15555550100');
    console.error('       npm run notification:test -- +233XXXXXXXXX');
    process.exit(1);
  }

  const region = resolveNotificationRegion({
    phoneNumber: testPhone
  });

  if (region === 'unsupported') {
    console.error(`Unsupported recipient region for phone: ${testPhone}`);
    process.exit(1);
  }

  await notificationProvider.sendSms({
    recipient: {
      phoneNumber: testPhone,
      country: region === 'ghana' ? 'Ghana' : 'United States',
      firstName: 'Progress',
      lastName: 'Log'
    },
    body: `[PROGRESS LOG] Hello Progress, this is a notification setup verification message. Open Progress Log to view your projects.`,
    metadata: {
      event: 'setup_test'
    }
  });

  console.log('Notification verification passed.');
  console.log(`Driver: ${notificationDriver}`);
  console.log(`Region: ${region}`);
  console.log(`Provider: ${region === 'ghana' ? 'Arkesel' : 'Surge'}`);
  if (region === 'usa') {
    console.log(`Surge account: ${env.SURGE_ACCOUNT_ID}`);
  } else {
    console.log(`Arkesel sender: ${env.ARKESEL_SENDER_ID}`);
  }
  console.log(`Recipient: ${testPhone}`);
}

main().catch((error) => {
  console.error('Notification verification failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
