import pg from 'pg';

const connectionString = 'postgresql://postgres.hmdewtmtxgfyunyypcon:Omharsh@2006@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const stalls = await pool.query('SELECT id, name FROM stalls');
    console.log('STALLS:', stalls.rows);

    const items = await pool.query("SELECT * FROM menu_items WHERE stallId = 'oodles-of-noodles'");
    console.log('ITEMS FOR oodles-of-noodles:', items.rows);
  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    pool.end();
  }
}

run();
