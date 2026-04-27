import pg from 'pg';
import 'dotenv/config';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function test() {
  try {
    const result = await pool.query('SELECT id, name, end_of_area_level FROM areas LIMIT 3');
    console.log('AREAS:', JSON.stringify(result.rows, null, 2));
    const projResult = await pool.query('SELECT id, name, end_of_area_level FROM projects LIMIT 3');
    console.log('PROJECTS:', JSON.stringify(projResult.rows, null, 2));
    await pool.end();
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  }
}

test();
