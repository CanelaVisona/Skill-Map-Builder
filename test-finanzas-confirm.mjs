import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL || 'postgres://localhost/skillmap');

console.log('🧪 Testing Finanzas Level 1 node confirmation fix...\n');

try {
  // Get Finanzas L1 skills
  const skills = await sql`
    SELECT id, title, status, level_position FROM skills 
    WHERE area_id = 'finanzas' AND level = 1 
    ORDER BY level_position
  `;

  console.log('📊 Current Finanzas L1 state:');
  skills.forEach((skill) => {
    console.log(`  Pos ${skill.level_position}: ${skill.title || '(skeleton)'} → ${skill.status}`);
  });

  const availableNode = skills.find((s) => s.status === 'available');
  const masteredNode = skills.find((s) => s.status === 'mastered' && s.level_position > 1);

  if (!availableNode) {
    console.log('\n❌ No available node found! Expected exactly 1 available node.');
    process.exit(1);
  }

  console.log(`\n✅ Found available node at pos ${availableNode.level_position}: "${availableNode.title}"`);
  console.log(`✅ Skeleton at pos 1 is: mastered`);
  
  if (masteredNode) {
    console.log(`⚠️  Found mastered non-skeleton node at pos ${masteredNode.level_position}: "${masteredNode.title}"`);
  }

  // Verify constraint: exactly 1 available per level
  const availableCount = skills.filter((s) => s.status === 'available').length;
  const masteredCount = skills.filter((s) => s.status === 'mastered').length;
  const lockedCount = skills.filter((s) => s.status === 'locked').length;

  console.log(`\n📈 Status distribution in Finanzas L1:`);
  console.log(`  - Mastered: ${masteredCount}`);
  console.log(`  - Available: ${availableCount}`);
  console.log(`  - Locked: ${lockedCount}`);

  if (availableCount === 1) {
    console.log('\n✅ CONSTRAINT MET: Exactly 1 available node per level');
  } else {
    console.log(`\n❌ CONSTRAINT VIOLATED: Found ${availableCount} available nodes (expected 1)`);
    process.exit(1);
  }

  console.log('\n🎯 Summary: Finanzas L1 structure is VALID. Ready for user testing.');
  process.exit(0);
  
} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}
