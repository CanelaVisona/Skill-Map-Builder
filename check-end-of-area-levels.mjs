import pkg from 'pg';
const { Pool } = pkg;

const databaseUrl = 'postgresql://neondb_owner:npg_QOqBSy0zVt5R@ep-rapid-band-ahn7lyss-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
  connectionString: databaseUrl,
});

async function checkDatabase() {
  try {
    console.log('Executing areas query...');
    const areasResult = await pool.query(
      'SELECT id, name, end_of_area_level, unlocked_level FROM areas ORDER BY name;'
    );
    
    console.log('Executing projects query...');
    const projectsResult = await pool.query(
      'SELECT id, name, end_of_area_level, unlocked_level FROM projects ORDER BY name;'
    );
    
    const output = {
      areas: areasResult.rows,
      projects: projectsResult.rows
    };
    
    console.log(JSON.stringify(output, null, 2));
    
    await pool.end();
  } catch (error) {
    console.error('Database error:', error);
    process.exit(1);
  }
}

checkDatabase();
