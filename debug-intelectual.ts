import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './shared/schema';
import { eq, and, asc } from 'drizzle-orm';

const { areas, skills } = schema;

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool, { schema });

(async () => {
  try {
    // Get Intelectual area
    const intelectualArea = await db.select().from(areas).where(eq(areas.id, 'intelectual'));
    
    if (!intelectualArea.length) {
      console.log('❌ Intelectual area not found');
      process.exit(1);
    }

    const area = intelectualArea[0];
    console.log('📍 ÁREA INTELECTUAL');
    console.log(`   unlockedLevel: ${area.unlockedLevel}`);
    console.log(`   nextLevelToAssign: ${area.nextLevelToAssign}`);
    console.log(`   endOfAreaLevel: ${area.endOfAreaLevel}\n`);

    // Get all skills in Intelectual
    const allSkills = await db.select().from(skills)
      .where(eq(skills.areaId, 'intelectual'))
      .orderBy(asc(skills.level), asc(skills.levelPosition));

    // Group by level
    const levelMap = new Map<number, typeof allSkills>();
    for (const skill of allSkills) {
      if (!levelMap.has(skill.level)) {
        levelMap.set(skill.level, []);
      }
      levelMap.get(skill.level)!.push(skill);
    }

    // Analyze each level
    console.log('📊 LEVEL ANALYSIS:\n');
    for (const [level, levelSkills] of Array.from(levelMap.entries()).sort((a, b) => a[0] - b[0])) {
      const isLevelUnlocked = level <= area.unlockedLevel;
      const statusCounts: Record<string, number> = {};
      
      for (const skill of levelSkills) {
        statusCounts[skill.status] = (statusCounts[skill.status] || 0) + 1;
      }

      console.log(`Level ${level} ${isLevelUnlocked ? '🔓 UNLOCKED' : '🔒 BLOCKED'}`);
      console.log(`  Status: ${JSON.stringify(statusCounts)}`);
      
      // Show available nodes
      const availableSkills = levelSkills.filter(s => s.status === 'available');
      if (availableSkills.length > 1) {
        console.log(`  ⚠️  ERROR: ${availableSkills.length} available nodes (should be 1)`);
      }
      
      availableSkills.forEach(s => {
        console.log(`      ⭐ Pos ${s.levelPosition}: "${s.title}"`);
      });

      // Show problem nodes
      const problemNodes = levelSkills.filter(s => 
        s.status === 'available' && 
        (s.title?.includes('Acordate color') || s.title?.includes('Cómo acordarse los nombres'))
      );
      
      if (problemNodes.length > 0) {
        console.log(`  🔴 PROBLEM NODES FOUND:`);
        problemNodes.forEach(s => {
          console.log(`      "${s.title}" - Status: ${s.status}, Level: ${s.level}, Pos: ${s.levelPosition}`);
        });
      }
      
      console.log();
    }

    // Find similar nodes
    console.log('🔍 SEARCHING FOR SIMILAR NODES:\n');
    const similarSkills = await db.select().from(skills).where(
      and(
        eq(skills.areaId, 'intelectual'),
        // Search for partial title matches
      )
    );

    // Manual search using the fetched data
    const problemKeywords = ['acordat', 'ilíada', 'color', 'animal'];
    const matches = allSkills.filter(s => 
      problemKeywords.some(kw => s.title?.toLowerCase().includes(kw))
    );

    if (matches.length > 0) {
      console.log(`Found ${matches.length} potential problem nodes:`);
      matches.forEach(s => {
        console.log(`  L${s.level}:P${s.levelPosition} [${s.status}] "${s.title.substring(0, 60)}"`);
      });
    }

    process.exit(0);
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
