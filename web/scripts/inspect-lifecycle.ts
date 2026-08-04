import { Client } from 'pg';

const connStr = process.env.DATABASE_URL || 'postgresql://voltium_user:voltium_pass@localhost:5432/voltium_dev?schema=public';
const url = new URL(connStr);
const schema = url.searchParams.get('schema') || 'public';
url.searchParams.set('schema', schema);

async function main() {
  const client = new Client({ connectionString: url.toString() });
  await client.connect();

  // Check for lifecycleStage on riders
  const r1 = await client.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = $1
      AND table_name = 'riders'
      AND column_name IN ('lifecycleStage', 'lifecycleStatus', 'assignedVehicle', 'currentPlan')
    ORDER BY column_name
  `, [schema]);
  console.log('riders columns:', r1.rows);

  // Check for the RiderLifecycleStage enum
  const r2 = await client.query(`
    SELECT typname FROM pg_type
    WHERE typname = 'RiderLifecycleStage'
  `);
  console.log('RiderLifecycleStage enum:', r2.rows);

  // Check for the CHECK constraints
  const r3 = await client.query(`
    SELECT conname
    FROM pg_constraint
    WHERE conname IN (
      'rider_battery_level_range',
      'rider_phone_format',
      'rider_email_format',
      'kyc_aadhaar_format',
      'kyc_pan_format',
      'kyc_ifsc_format'
    )
  `);
  console.log('CHECK constraints present:', r3.rows.map(r => r.conname));

  // Check riders lifecycleStatus distribution
  const r4 = await client.query(`
    SELECT "lifecycleStatus", COUNT(*) AS n
    FROM ${schema}.riders
    GROUP BY "lifecycleStatus"
    ORDER BY n DESC
  `).catch((e) => ({ rows: [], error: e.message }));
  if (r4.rows) {
    console.log('riders.lifecycleStatus distribution:', r4.rows);
  }

  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
