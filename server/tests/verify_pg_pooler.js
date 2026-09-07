import pg from 'pg';
const { Pool } = pg;

const projectRef = 'hmdewtmtxgfyunyypcon';
const password = 'SGUsmartbite%402026';

const regions = [
  'ap-south-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
  'ap-northeast-2',
  'us-east-1',
  'us-west-1',
  'us-west-2',
  'eu-central-1',
  'eu-west-1',
  'eu-west-2',
  'sa-east-1'
];

async function verify() {
  console.log('Testing regions...');
  for (const reg of regions) {
    const host = `aws-0-${reg}.pooler.supabase.com`;
    const url = `postgresql://postgres.${projectRef}:${password}@${host}:6543/postgres`;
    const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 2000 });
    try {
      const res = await pool.query('SELECT current_database(), current_user');
      console.log(`\n🎉 MATCH FOUND! Region: ${reg}`);
      console.log(`Working DATABASE_URL:\n${url}`);
      await pool.end();
      process.exit(0);
    } catch (err) {
      if (!err.message.includes('tenant/user') && !err.message.includes('ENOTFOUND')) {
        console.log(`[${reg}] ${err.message}`);
      }
      await pool.end();
    }
  }
  console.log('Done testing.');
}

verify();
