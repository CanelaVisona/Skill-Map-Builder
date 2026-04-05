const pg = require('pg');
require('dotenv').config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

(async () => {
  try {
    console.log('=== Checking end_of_area_level column in areas table ===\n');
    
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'areas' AND column_name = 'end_of_area_level'
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Column EXISTS:');
      result.rows.forEach(row => {
        console.log(`  - column_name: ${row.column_name}`);
        console.log(`  - data_type: ${row.data_type}`);
        console.log(`  - is_nullable: ${row.is_nullable}`);
      });
    } else {
      console.log('❌ Column DOES NOT EXIST in areas table');
    }
    
    console.log('\n=== ALL columns in areas table ===\n');
    const allCols = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'areas'
      ORDER BY ordinal_position
    `);
    
    allCols.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}${row.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
    });
    
    console.log('\n=== Testing updateArea with endOfAreaLevel ===\n');
    
    try {
      const testUpdate = await pool.query(`
        UPDATE areas 
        SET end_of_area_level = $1 
        WHERE name = 'life'
        RETURNING id, name, end_of_area_level
      `, [2]);
      
      if (testUpdate.rows.length > 0) {
        console.log('✅ UPDATE successful, endOfAreaLevel can be set');
        console.log('Updated area:', testUpdate.rows[0]);
      }
    } catch (updateError) {
      console.log('❌ UPDATE failed:');
      console.log(`  Error: ${updateError.message}`);
    }
    
    await pool.end();
  } catch (error) {
    console.error('❌ Database Error:', error.message);
    process.exit(1);
  }
})();
