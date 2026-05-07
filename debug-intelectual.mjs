import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config();

const sql = postgres(process.env.DATABASE_URL || 'postgres://localhost/skillmap');

console.log('🔍 Debugging Intelectual area...\n');

try {
  // Get area info
  const area = await sql`
    SELECT id, name, unlocked_level, next_level_to_assign, end_of_area_level
    FROM areas 
    WHERE id = 'intelectual'
  `;

  if (!area.length) {
    console.log('❌ Area not found');
    process.exit(1);
  }

  const areaData = area[0];
  console.log('📍 Area Intelectual:');
  console.log(`  - unlockedLevel: ${areaData.unlocked_level}`);
  console.log(`  - nextLevelToAssign: ${areaData.next_level_to_assign}`);
  console.log(`  - endOfAreaLevel: ${areaData.end_of_area_level}\n`);

  // Find those specific nodes
  const problemNodes = await sql`
    SELECT 
      id, title, status, level, level_position, y
    FROM skills 
    WHERE area_id = 'intelectual' 
      AND (title ILIKE '%Acordate color%' OR title ILIKE '%Cómo acordarse los nombres%')
    ORDER BY level, level_position
  `;

  console.log('🔴 Problem nodes found:');
  problemNodes.forEach(node => {
    console.log(`  - Level ${node.level}, Pos ${node.level_position}: "${node.title}"`);
    console.log(`    Status: ${node.status}, Y: ${node.y}`);
  });

  if (problemNodes.length === 0) {
    console.log('  ❌ No exact match. Searching for similar...');
    const similarNodes = await sql`
      SELECT 
        id, title, status, level, level_position, y
      FROM skills 
      WHERE area_id = 'intelectual' 
        AND (title ILIKE '%acordar%' OR title ILIKE '%ilíada%' OR title ILIKE '%animal%' OR title ILIKE '%nombre%')
      ORDER BY level, level_position
    `;
    
    console.log(`  Found ${similarNodes.length} similar nodes:`);
    similarNodes.forEach(node => {
      console.log(`    - L${node.level}:P${node.level_position} [${node.status}] "${node.title.substring(0, 50)}..."`);
    });
  }

  // Get all nodes in problematic levels
  console.log('\n📊 Full level breakdown:');
  const allLevels = await sql`
    SELECT DISTINCT level FROM skills 
    WHERE area_id = 'intelectual' 
    ORDER BY level
  `;

  for (const levelRow of allLevels) {
    const level = levelRow.level;
    const isBlocked = level > areaData.unlocked_level;
    
    const levelSkills = await sql`
      SELECT 
        id, title, status, level_position, is_auto_complete, level_position = 1 as is_skeleton
      FROM skills 
      WHERE area_id = 'intelectual' AND level = ${level}
      ORDER BY level_position
    `;

    const statusCounts = {};
    levelSkills.forEach(s => {
      statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
    });

    console.log(`  Level ${level} ${isBlocked ? '🔒 (BLOCKED)' : '🔓 (unlocked)'}: ${JSON.stringify(statusCounts)}`);
    
    // Show available nodes
    const availableNodes = levelSkills.filter(s => s.status === 'available');
    if (availableNodes.length > 0) {
      availableNodes.forEach(n => {
        console.log(`    ⚠️  AVAILABLE: Pos${n.level_position} "${n.title.substring(0, 40)}"`);
      });
    }
  }

  process.exit(0);
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
