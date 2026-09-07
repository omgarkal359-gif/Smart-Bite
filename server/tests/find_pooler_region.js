import pg from 'pg';
import dns from 'dns';
const { Pool } = pg;

const projectRef = 'hmdewtmtxgfyunyypcon';
const password = 'SGUsmartbite%402026';

// Let's test all Supabase pooler regions with IPv4
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
  'eu-west-3',
  'sa-east-1',
  'ca-central-1'
];

console.log('Testing regions for Supabase IPv4 Pooler...');

for (const region of regions) {
  const host = `aws-0-${region}.pooler.supabase.com`;
  const url = `postgresql://postgres.${projectRef}:${password}@${host}:6543/postgres`;
  
  const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 3000 });
  try {
    const res = await pool.query('SELECT NOW()');
    console.log(`\n==================================================`);
    console.log(`>>> SUCCESS! SUPABASE REGION FOUND: ${region}`);
    console.log(`>>> WORKING DATABASE_URL FOR .ENV: ${url}`);
    console.log(`==================================================\n`);
    await pool.end();
    process.exit(0);
  } catch (err) {
    if (!err.message.includes('tenant/user') && !err.message.includes('ENOTFOUND')) {
      console.log(`Region ${region} responded with: ${err.message}`);
    }
    await pool.end();
  }
}
console.log('Finished testing all regions.');
