import dns from 'dns';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
const { Pool } = pg;
dns.setDefaultResultOrder('ipv4first');

// All credentials come from the environment — never hard-code DB passwords or
// keys in source. URL-encode special chars in the password (e.g. @ -> %40).
//   SUPABASE_PROJECT_REF, SUPABASE_DB_PASSWORD,
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, DATABASE_URL (optional)
const projectRef = process.env.SUPABASE_PROJECT_REF;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;
if (!projectRef || !dbPassword) {
  console.error('Set SUPABASE_PROJECT_REF and SUPABASE_DB_PASSWORD in the environment.');
  process.exit(1);
}

const dbHost = `db.${projectRef}.supabase.co`;
console.log(`Testing DNS lookup for ${dbHost}...`);
try {
  const addresses = await dns.promises.lookup(dbHost, { all: true });
  console.log('DNS Lookup results:', addresses);
} catch (dnsErr) {
  console.log('DNS Lookup failed:', dnsErr.message);
}

console.log('Testing Supabase JS Client...');
const supabaseUrl = process.env.VITE_SUPABASE_URL || `https://${projectRef}.supabase.co`;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

try {
  const { data, error } = await supabase.from('accounts').select('count', { count: 'exact', head: true });
  if (error) {
    console.log('Supabase JS Client error:', error.message);
  } else {
    console.log('Supabase JS Client connected successfully!');
  }
} catch (err) {
  console.log('Supabase JS Client exception:', err.message);
}

console.log('\nTesting PG direct connection string:', process.env.DATABASE_URL ? '(from DATABASE_URL)' : '(not set)');
if (process.env.DATABASE_URL) {
  const poolDirect = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  try {
    const res = await poolDirect.query('SELECT NOW()');
    console.log('PG direct connection SUCCESS:', res.rows[0]);
    await poolDirect.end();
  } catch (err) {
    console.log('PG direct connection FAILED:', err.message);
  }
}

// Probe common Supabase pooler username formats, ports, and regions to discover
// the working connection string. Password is injected from the environment.
const pw = encodeURIComponent(dbPassword) === dbPassword ? dbPassword : dbPassword; // already-encoded passwords pass through
const testUrls = [
  `postgresql://postgres:${pw}@${dbHost}:6543/postgres`,
  `postgresql://postgres.${projectRef}:${pw}@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`,
  `postgresql://postgres.${projectRef}:${pw}@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`,
  `postgresql://postgres:${pw}@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`,
  `postgresql://postgres:${pw}@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`
];

const regions = ['ap-south-1', 'ap-southeast-1', 'us-east-1', 'us-west-1', 'eu-west-1', 'sa-east-1'];
for (const reg of regions) {
  testUrls.push(`postgresql://postgres.${projectRef}:${pw}@aws-0-${reg}.pooler.supabase.com:6543/postgres`);
  testUrls.push(`postgresql://postgres.${projectRef}:${pw}@aws-0-${reg}.pooler.supabase.com:5432/postgres`);
}

for (const url of testUrls) {
  const hostMatch = url.match(/@([^:\/]+):(\d+)/);
  const userMatch = url.match(/\/\/([^:]+):/);
  console.log(`\nTesting User: ${userMatch ? userMatch[1] : '?'} Host: ${hostMatch ? hostMatch[1] : '?'} Port: ${hostMatch ? hostMatch[2] : '?'}`);
  const p = new Pool({ connectionString: url, connectionTimeoutMillis: 3000 });
  try {
    const res = await p.query('SELECT NOW()');
    console.log('>>> SUCCESS! Working host/port:', hostMatch ? `${hostMatch[1]}:${hostMatch[2]}` : url);
    console.log('QueryResult:', res.rows[0]);
    await p.end();
    break;
  } catch (err) {
    console.log('Failed:', err.message);
    await p.end();
  }
}
