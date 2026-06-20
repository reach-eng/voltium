import { db } from '../src/lib/db';
import { hashPassword } from '../src/lib/password';

async function main() {
  const email = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@voltium.io';
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    console.error('Error: ADMIN_PASSWORD environment variable is not set.');
    process.exit(1);
  }

  console.log(`Seeding dev admin with email: ${email}...`);

  const hashedPassword = await hashPassword(password);

  const admin = await db.admin.upsert({
    where: { email },
    update: {
      password: hashedPassword,
      isActive: true,
      role: 'SUPER_ADMIN',
    },
    create: {
      email,
      password: hashedPassword,
      name: 'Dev Admin',
      role: 'SUPER_ADMIN',
      isActive: true,
      permissions: JSON.stringify([
        'riders_view',
        'riders_create',
        'riders_update',
        'riders_delete',
        'kyc_view',
        'kyc_approve',
        'kyc_reject',
        'kyc_add_field_note',
        'kyc_view_limited',
        'guarantor_view_limited',
        'vehicles_view',
        'vehicles_create',
        'vehicles_update',
        'vehicles_delete',
        'hubs_manage',
        'transactions_view',
        'transactions_approve',
        'transactions_reject',
        'transactions_manage',
        'tickets_view',
        'tickets_resolve',
        'tickets_manage',
        'notifications_manage',
        'analytics_view',
        'admins_manage',
        'plans_manage',
        'settings_manage',
        'legal_manage',
        'faq_manage',
        'referrals_view',
        'rewards_manage',
        'offers_manage',
        'device_tracking_view',
        'device_remote_control',
        'rentals_pickup_inspection',
        'rentals_return_inspection',
        'vehicles_inspect',
        'files_view_kyc',
        'files_view_payment_proof',
        'files_view_support_attachment',
        'data_management_view',
        'data_management_backup',
        'data_management_restore',
        'data_management_schedule',
        'data_management_download',
        'data_management_test',
        'incidents_manage',
        'riders_manage',
        'fleet_manage',
        'impersonate_riders',
      ]),
    },
  });

  console.log(`Successfully seeded admin: ${admin.email} (ID: ${admin.id}, Role: ${admin.role})`);
}

main()
  .catch((e) => {
    console.error('Error seeding dev admin:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
