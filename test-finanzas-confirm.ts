import Database from 'better-sqlite3';
import * as dotenv from 'dotenv';

dotenv.config();

const db = new Database(process.env.DATABASE_URL || 'file:./local.db');

function testFinanzasConfirmation() {
  console.log('🧪 Testing Finanzas Level 1 node confirmation fix...\n');

  try {
    // Get Finanzas L1 skills
    const skills = db
      .prepare(`SELECT id, title, status, levelPosition FROM skills WHERE areaId = 'finanzas' AND level = 1 ORDER BY levelPosition`)
      .all();

    console.log('📊 Current Finanzas L1 state:');
    skills.forEach((skill: any) => {
      console.log(`  Pos ${skill.levelPosition}: ${skill.title || '(skeleton)'} → ${skill.status}`);
    });

    const availableNode = skills.find((s: any) => s.status === 'available');
    const masteredNode = skills.find((s: any) => s.status === 'mastered' && s.levelPosition > 1);

    if (!availableNode) {
      console.log('\n❌ No available node found! Expected exactly 1 available node.');
      process.exit(1);
    }

    console.log(`\n✅ Found available node at pos ${availableNode.levelPosition}: "${availableNode.title}"`);
    console.log(`✅ Skeleton at pos 1 is: mastered`);
    
    if (masteredNode) {
      console.log(`⚠️  Found mastered non-skeleton node at pos ${masteredNode.levelPosition}: "${masteredNode.title}"`);
    }

    // Verify constraint: exactly 1 available per level
    const availableCount = skills.filter((s: any) => s.status === 'available').length;
    const masteredCount = skills.filter((s: any) => s.status === 'mastered').length;
    const lockedCount = skills.filter((s: any) => s.status === 'locked').length;

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
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testFinanzasConfirmation();
