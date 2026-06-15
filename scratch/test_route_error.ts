import { db } from '../src/lib/db';
import { generateOtp } from '../src/lib/otp-store';
import { JobQueue, JobTypes } from '../src/lib/job-queue';
import { logger } from '../src/lib/logger';
import { getFeatureFlags } from '../src/lib/feature-flags';

async function main() {
  const phone = '9876543210';
  const fullPhone = '+91' + phone;

  console.log('Testing feature flags...');
  const flags = await getFeatureFlags();
  console.log('Flags:', flags);

  console.log('Checking database rider findUnique...');
  const existingRider = await db.rider.findUnique({
    where: { phone: fullPhone },
  });
  console.log('Existing rider:', existingRider);

  console.log('Generating OTP...');
  const otp = await generateOtp(phone);
  console.log('Generated OTP:', otp);

  console.log('Enqueueing JobQueue...');
  const message = `Your Voltium verification code is: ${otp}. Do not share this code with anyone.`;
  await JobQueue.enqueue(JobTypes.SEND_SMS, {
    phone,
    message,
    channel: 'sms',
  });
  console.log('Job enqueued successfully!');
}

main()
  .catch((e) => {
    console.error('ERROR OCCURRED IN SCRIPT:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
