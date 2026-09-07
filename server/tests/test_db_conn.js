import dns from 'dns';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
const { Pool } = pg;
dns.setDefaultResultOrder('ipv4first');

console.log('Testing DNS lookup for db.hmdewtmtxgfyunyypcon.supabase.co...');
try {
  const addresses = await dns.promises.lookup('db.hmdewtmtxgfyunyypcon.supabase.co', { all: true });
  console.log('DNS Lookup results:', addresses);
} catch (dnsErr) {
  console.log('DNS Lookup failed:', dnsErr.message);
}


console.log('Testing Supabase JS Client...');
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://hmdewtmtxgfyunyypcon.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

try {
  const { data, error } = await supabase.from('users').select('count', { count: 'exact', head: true });
  if (error) {
    console.log('Supabase JS Client error:', error.message);
  } else {
    console.log('Supabase JS Client connected successfully!');
  }
} catch (err) {
  console.log('Supabase JS Client exception:', err.message);
}

console.log('\nTesting PG direct connection string:', process.env.DATABASE_URL);
const poolDirect = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
try {
  const res = await poolDirect.query('SELECT NOW()');
  console.log('PG direct connection SUCCESS:', res.rows[0]);
  await poolDirect.end();
} catch (err) {
  console.log('PG direct connection FAILED:', err.message);
}

// Let's test Supabase Pooler username formats and pooler ports:
// Direct hostname: db.hmdewtmtxgfyunyypcon.supabase.co (IPv4 direct pooler host: db.hmdewtmtxgfyunyypcon.supabase.co or pooler host)
// In Supabase, Pooler host can be:
// 1. postgres.hmdewtmtxgfyunyypcon with host aws-0-ap-south-1.pooler.supabase.com
// 2. postgres with host db.hmdewtmtxgfyunyypcon.supabase.co
// 3. postgresql://postgres:SGUsmartbite%402026@db.hmdewtmtxgfyunyypcon.supabase.co:6543/postgres (session/transaction pooler on port 6543 or 5432)

const testUrls = [
  'postgresql://postgres:SGUsmartbite%402026@db.hmdewtmtxgfyunyypcon.supabase.co:6543/postgres',
  'postgresql://postgres.hmdewtmtxgfyunyypcon:SGUsmartbite%402026@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
  'postgresql://postgres.hmdewtmtxgfyunyypcon:SGUsmartbite%402026@aws-0-ap-south-1.pooler.supabase.com:6543/postgres',
  'postgresql://postgres:SGUsmartbite%402026@aws-0-ap-south-1.pooler.supabase.com:6543/postgres',
  'postgresql://postgres:SGUsmartbite%402026@aws-0-ap-south-1.pooler.supabase.com:5432/postgres'
];

// Let's also check if project hmdewtmtxgfyunyypcon is in ap-southeast-1, us-east-1, etc.
const regions = ['ap-south-1', 'ap-southeast-1', 'us-east-1', 'us-west-1', 'eu-west-1', 'sa-east-1'];
for (const reg of regions) {
  testUrls.push(`postgresql://postgres.hmdewtmtxgfyunyypcon:SGUsmartbite%402026@aws-0-${reg}.pooler.supabase.com:6543/postgres`);
  testUrls.push(`postgresql://postgres.hmdewtmtxgfyunyypcon:SGUsmartbite%402026@aws-0-${reg}.pooler.supabase.com:5432/postgres`);
}

for (const url of testUrls) {
  const hostMatch = url.match(/@([^:\/]+):(\d+)/);
  const userMatch = url.match(/\/\/(.*):SGUsmartbite/);
  console.log(`\nTesting User: ${userMatch ? userMatch[1] : '?'} Host: ${hostMatch ? hostMatch[1] : '?'} Port: ${hostMatch ? hostMatch[2] : '?'}`);
  const p = new Pool({ connectionString: url, connectionTimeoutMillis: 3000 });
  try {
    const res = await p.query('SELECT NOW()');
    console.log('>>> SUCCESS! Working URL:', url);
    console.log('QueryResult:', res.rows[0]);
    await p.end();
    break;
  } catch (err) {
    console.log('Failed:', err.message);
    await p.end();
  }
}

