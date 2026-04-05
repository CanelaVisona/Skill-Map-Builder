const pg = require('pg');
require('dotenv').config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

(async () => {
  try {
    console.log('=== Checking endOfAreaLevel value for life area ===\n');
    
    const result = await pool.query(`
      SELECT id, name, end_of_area_level 
      FROM areas 
      WHERE name = 'life'
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Found life area:');
      result.rows.forEach(row => {
        console.log(`  - id: ${row.id}`);
        console.log(`  - name: ${row.name}`);
        console.log(`  - end_of_area_level: ${row.end_of_area_level}`);
      });
    } else {
      console.log('❌ No area named "life" found');
    }
    
    console.log('\n=== Checking all areas and their endOfAreaLevel ===\n');
    const allAreas = await pool.query(`
      SELECT id, name, end_of_area_level 
      FROM areas 
      ORDER BY name
    `);
    
    allAreas.rows.forEach(row => {
      console.log(`${row.name.padEnd(15)} | end_of_area_level: ${row.end_of_area_level}`);
    });
    
    await pool.end();
  } catch (error) {
    console.error('❌ Database Error:', error.message);
    process.exit(1);
  }
})();
