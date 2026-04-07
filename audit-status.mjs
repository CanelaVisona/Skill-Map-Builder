import { neon } from '@neondatabase/serverless';

const dbUrl = 'postgresql://neondb_owner:npg_QOqBSy0zVt5R@ep-rapid-band-ahn7lyss-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = neon(dbUrl);

console.log('Ì≥ä DATABASE STATUS ORDERING AUDIT\n');

try {
  // Check for levels with locked nodes BEFORE available node
  const result1 = await sql`
    WITH level_data AS (
      SELECT 
        area_id,
        level,
        level_position,
        status,
        LAG(status) OVER (PARTITION BY area_id, level ORDER BY level_position) as prev_status
      FROM skills
      WHERE area_id IS NOT NULL
        AND status IN ('mastered', 'available', 'locked')
    )
    SELECT DISTINCT area_id, level
    FROM level_data
    WHERE (status = 'locked' AND prev_status = 'available')
    ORDER BY area_id, level;
  `;

  console.log(`‚ùå Levels with LOCKED before AVAILABLE: ${result1.length}`);
  if (result1.length > 0) {
    result1.forEach(row => {
      console.log(`   - Area: ${row.area_id}, Level: ${row.level}`);
    });
  }

  // Check for multiple available nodes per level
  const result2 = await sql`
    SELECT area_id, level, COUNT(*) as count
    FROM skills
    WHERE area_id IS NOT NULL
      AND status = 'available'
    GROUP BY area_id, level
    HAVING COUNT(*) > 1
    ORDER BY area_id, level;
  `;

  console.log(`\n‚ùå Levels with MULTIPLE available nodes: ${result2.length}`);
  if (result2.length > 0) {
    result2.forEach(row => {
      console.log(`   - Area: ${row.area_id}, Level: ${row.level} (${row.count} available)`);
    });
  }

  // Check position 1 not mastered
  const result3 = await sql`
    SELECT area_id, level, status
    FROM skills
    WHERE area_id IS NOT NULL
      AND level_position = 1
      AND status != 'mastered'
    ORDER BY area_id, level;
  `;

  console.log(`\n‚ùå Levels with position 1 NOT mastered: ${result3.length}`);
  if (result3.length > 0) {
    result3.forEach(row => {
      console.log(`   - Area: ${row.area_id}, Level: ${row.level}, Status: ${row.status}`);
    });
  }

  const totalIssues = result1.length + result2.length + result3.length;
  console.log(`\nÌ≥ã TOTAL ISSUES FOUND: ${totalIssues}\n`);

  if (totalIssues === 0) {
    console.log('‚úÖ All levels have CORRECT status ordering!');
  }

  process.exit(0);
} catch (err) {
  console.error('‚ùå Error:', err.message);
  process.exit(1);
}
