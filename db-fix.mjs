import pkg from 'pg';
const { Client } = pkg;

const connectionString = 'postgresql://neondb_owner:npg_QOqBSy0zVt5R@ep-rapid-band-ahn7lyss-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';
const client = new Client({ connectionString });

async function runFixes() {
  try {
    await client.connect();
    console.log('Connected to database');

    // DB Fix 1: Ensure all Node 1s are mastered
    console.log('\n=== DB FIX 1: Node 1 Mastery ===');
    const fix1Result = await client.query(
      `UPDATE skills SET status = 'mastered', is_auto_complete = 1, title = ''
       WHERE level_position = 1
       AND (status != 'mastered' OR is_auto_complete != 1 OR (title IS NOT NULL AND title != ''))`
    );
    console.log(`Fixed ${fix1Result.rowCount} Node 1 records`);

    // Verify Node 1
    const verify1 = await client.query(
      `SELECT COUNT(*) as count FROM skills WHERE level_position = 1 AND status != 'mastered'`
    );
    console.log(`Node 1 unconfirmed count: ${verify1.rows[0].count}`);

    // DB Fix 2: Find broken sequences
    console.log('\n=== DB FIX 2: Check for Broken Sequences ===');
    const brokenSeqs = await client.query(
      `SELECT s1.area_id, s1.level, s1.level_position as locked_pos, s1.status,
              s2.level_position as available_pos
       FROM skills s1
       JOIN skills s2 ON s1.area_id = s2.area_id AND s1.level = s2.level
       WHERE s1.status = 'locked'
       AND s2.status = 'available'
       AND s1.level_position < s2.level_position
       AND s1.area_id IS NOT NULL
       LIMIT 10`
    );
    
    console.log(`Found ${brokenSeqs.rowCount} broken sequences (showing max 10)`);
    if (brokenSeqs.rowCount > 0) {
      brokenSeqs.rows.forEach(row => {
        console.log(`  Area: ${row.area_id}, Level: ${row.level}, Locked at pos ${row.locked_pos} before Available at ${row.available_pos}`);
      });
    }

    // Get total count of broken sequences
    const totalBroken = await client.query(
      `SELECT COUNT(*) as count
       FROM skills s1
       JOIN skills s2 ON s1.area_id = s2.area_id AND s1.level = s2.level
       WHERE s1.status = 'locked'
       AND s2.status = 'available'
       AND s1.level_position < s2.level_position
       AND s1.area_id IS NOT NULL`
    );
    console.log(`Total broken sequences: ${totalBroken.rows[0].count}`);

    // Fix broken sequences by updating locked nodes that appear before available ones
    if (totalBroken.rows[0].count > 0) {
      console.log('\nFixing broken sequences...');
      const fix2Result = await client.query(
        `WITH broken AS (
           SELECT s1.id
           FROM skills s1
           JOIN skills s2 ON s1.area_id = s2.area_id AND s1.level = s2.level
           WHERE s1.status = 'locked'
           AND s2.status = 'available'
           AND s1.level_position < s2.level_position
           AND s1.area_id IS NOT NULL
         )
         UPDATE skills SET status = 'available'
         WHERE id IN (SELECT id FROM broken)`
      );
      console.log(`Fixed ${fix2Result.rowCount} nodes by setting them to available`);
    }

    // Verify fix
    const verifyFix = await client.query(
      `SELECT COUNT(*) as count
       FROM skills s1
       JOIN skills s2 ON s1.area_id = s2.area_id AND s1.level = s2.level
       WHERE s1.status = 'locked'
       AND s2.status = 'available'
       AND s1.level_position < s2.level_position
       AND s1.area_id IS NOT NULL`
    );
    console.log(`Broken sequences after fix: ${verifyFix.rows[0].count}`);

    console.log('\n=== ALL FIXES COMPLETE ===');

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

runFixes();
