import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function auditDatabase() {
  try {
    console.log('Auditing database for invalid status sequences...\n');

    const result = await pool.query(`
      SELECT 
        area_id, 
        level, 
        level_position, 
        status, 
        title,
        id
      FROM skills
      WHERE area_id IS NOT NULL
      ORDER BY area_id, level, level_position
    `);

    const rows = result.rows;

    if (!rows || !rows.length) {
      console.log('No skills found in database.');
      await pool.end();
      process.exit(0);
    }

    // Group by area_id and level
    const sequences = {};
    for (const skill of rows) {
      const key = `${skill.area_id}_${skill.level}`;
      if (!sequences[key]) {
        sequences[key] = {
          area_id: skill.area_id,
          level: skill.level,
          skills: []
        };
      }
      sequences[key].skills.push({
        id: skill.id,
        pos: skill.level_position,
        status: skill.status,
        title: skill.title
      });
    }

    // Check for invalid sequences (locked before available)
    const brokenLevels = [];
    let totalLevels = Object.keys(sequences).length;
    
    for (const [key, seq] of Object.entries(sequences)) {
      // Find available node position
      const availableNode = seq.skills.find(s => s.status === 'available');
      
      if (availableNode) {
        // Check if any locked node appears before the available node
        const hasLockedBefore = seq.skills.some(s => 
          s.pos < availableNode.pos && s.status === 'locked'
        );
        
        if (hasLockedBefore) {
          brokenLevels.push({
            key,
            area_id: seq.area_id,
            level: seq.level,
            sequence: seq.skills.map(s => `${s.pos}:${s.status}(${s.title})`).join(' → '),
            availablePos: availableNode.pos,
            availableNodeId: availableNode.id,
            skills: seq.skills
          });
        }
      }
    }

    // Report
    console.log(`Total Levels Checked: ${totalLevels}`);
    console.log(`Broken Levels Found: ${brokenLevels.length}\n`);
    
    if (brokenLevels.length > 0) {
      console.log('BROKEN SEQUENCES (locked before available):');
      console.log('='.repeat(100));
      
      for (const broken of brokenLevels) {
        console.log(`\n📍 Area ${broken.area_id}, Level ${broken.level}`);
        console.log(`   Sequence: ${broken.sequence}`);
        console.log(`   Issue: Locked node(s) before available at position ${broken.availablePos}`);
        console.log(`   Available Node ID: ${broken.availableNodeId}`);
      }
      
      console.log('\n' + '='.repeat(100));
      console.log(`\n⚠️  RECOMMENDATION:`);
      console.log(`${brokenLevels.length} level(s) have invalid status sequences.`);
      console.log(`These were likely corrupted by the previous reorder logic bug.`);
      console.log(`Run repair to fix these sequences based on the new position-follows-status rule.`);
    } else {
      console.log('✅ All levels have valid status sequences!');
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
    process.exit(1);
  }
}

auditDatabase();
