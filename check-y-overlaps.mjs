import { config } from 'dotenv';
import pkg from 'pg';
const { Client } = pkg;

config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

await client.connect();

try {
  // Find areas where levels have overlapping y-coordinates
  const result = await client.query(`
    WITH level_y_ranges AS (
      SELECT 
        area_id,
        level,
        MIN(y) as min_y,
        MAX(y) as max_y,
        COUNT(*) as skill_count
      FROM skills
      WHERE area_id IS NOT NULL
      GROUP BY area_id, level
    )
    SELECT DISTINCT 
      l1.area_id,
      COUNT(DISTINCT l1.level) as affected_levels
    FROM level_y_ranges l1
    JOIN level_y_ranges l2 
      ON l1.area_id = l2.area_id 
      AND l1.level < l2.level
      AND l1.max_y >= l2.min_y - 100  -- Overlapping or too close (less than 150 gap)
    GROUP BY l1.area_id
    ORDER BY l1.area_id;
  `);
  
  console.log('Areas with potential y-overlaps:');
  if (result.rows.length === 0) {
    console.log('✓ No overlaps found - all areas have proper spacing!');
  } else {
    result.rows.forEach(row => {
      console.log(`  - Area ${row.area_id}: ${row.affected_levels} levels affected`);
    });
  }
  
  // Show detailed breakdown for each affected area
  if (result.rows.length > 0) {
    console.log('\nDetailed breakdown:');
    for (const row of result.rows) {
      const detail = await client.query(`
        WITH level_y_ranges AS (
          SELECT 
            level,
            MIN(y) as min_y,
            MAX(y) as max_y,
            COUNT(*) as skill_count
          FROM skills
          WHERE area_id = $1
          GROUP BY level
        )
        SELECT level, min_y, max_y, max_y - min_y as height, skill_count
        FROM level_y_ranges
        ORDER BY level;
      `, [row.area_id]);
      
      console.log(`\n  Area ${row.area_id}:`);
      detail.rows.forEach((r, i) => {
        const nextRow = detail.rows[i + 1];
        const gap = nextRow ? nextRow.min_y - r.max_y : 'N/A';
        console.log(`    Level ${r.level}: y ${r.min_y}-${r.max_y} (${r.skill_count} skills), gap to next: ${gap}`);
      });
    }
  }
} finally {
  await client.end();
}
