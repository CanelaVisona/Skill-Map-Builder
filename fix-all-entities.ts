import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './shared/schema';
import { eq, and, asc, or } from 'drizzle-orm';

const { areas, projects, skills } = schema;

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool, { schema });

async function recalculateLevelStatuses(levelSkills: typeof skills[], unlockedLevel: number) {
  if (levelSkills.length === 0) return;

  // Position 1 MUST be mastered
  if (levelSkills[0].levelPosition === 1) {
    if (levelSkills[0].status !== "mastered") {
      await db.update(skills).set({ status: "mastered" }).where(eq(skills.id, levelSkills[0].id));
    }
  }

  // Auto-complete nodes always mastered
  for (const skill of levelSkills) {
    if (skill.isAutoComplete === 1 && skill.status !== "mastered") {
      await db.update(skills).set({ status: "mastered" }).where(eq(skills.id, skill.id));
    }
  }

  // If level is blocked, lock all non-skeleton nodes
  const level = levelSkills[0].level;
  if (level > unlockedLevel) {
    for (let i = 1; i < levelSkills.length; i++) {
      if (levelSkills[i].status !== "locked") {
        await db.update(skills).set({ status: "locked" }).where(eq(skills.id, levelSkills[i].id));
      }
    }
    return;
  }

  // For unlocked levels: find first non-mastered
  let firstNonMasteredIndex = -1;
  for (let i = 1; i < levelSkills.length; i++) {
    if (levelSkills[i].status !== "mastered") {
      firstNonMasteredIndex = i;
      break;
    }
  }

  // Update statuses
  for (let i = 0; i < levelSkills.length; i++) {
    const skill = levelSkills[i];
    let newStatus: "mastered" | "available" | "locked";
    
    if (i === 0) {
      newStatus = "mastered";
    } else if (firstNonMasteredIndex === -1) {
      // All mastered - keep as mastered
      newStatus = "mastered";
    } else if (i === firstNonMasteredIndex) {
      newStatus = "available";
    } else {
      newStatus = "locked";
    }

    if (skill.status !== newStatus) {
      await db.update(skills).set({ status: newStatus }).where(eq(skills.id, skill.id));
    }
  }
}

(async () => {
  try {
    console.log('🔧 FIXING ALL AREAS AND PROJECTS\n');

    let fixedCount = 0;

    // Fix AREAS
    const allAreas = await db.select().from(areas);
    console.log(`📍 Processing ${allAreas.length} areas...`);

    for (const area of allAreas) {
      const allSkills = await db.select().from(skills)
        .where(eq(skills.areaId, area.id));

      if (allSkills.length === 0) continue;

      const levels = new Set(allSkills.map(s => s.level));
      
      for (const level of Array.from(levels).sort((a, b) => a - b)) {
        const levelSkills = allSkills
          .filter(s => s.level === level)
          .sort((a, b) => a.levelPosition - b.levelPosition);
        
        await recalculateLevelStatuses(levelSkills, area.unlockedLevel);
      }

      fixedCount++;
    }

    // Fix PROJECTS
    const allProjects = await db.select().from(projects);
    console.log(`📍 Processing ${allProjects.length} projects...`);

    for (const project of allProjects) {
      const allSkills = await db.select().from(skills)
        .where(eq(skills.projectId, project.id));

      if (allSkills.length === 0) continue;

      const levels = new Set(allSkills.map(s => s.level));
      
      for (const level of Array.from(levels).sort((a, b) => a - b)) {
        const levelSkills = allSkills
          .filter(s => s.level === level)
          .sort((a, b) => a.levelPosition - b.levelPosition);
        
        await recalculateLevelStatuses(levelSkills, project.unlockedLevel);
      }

      fixedCount++;
    }

    console.log(`\n✅ Fixed ${fixedCount} entities (${allAreas.length} areas + ${allProjects.length} projects)!\n`);

    // Final verification
    console.log('📊 FINAL VERIFICATION:\n');

    let allValid = true;
    let validAreas = 0;
    let validProjects = 0;

    // Verify areas
    for (const area of allAreas.sort((a, b) => a.name.localeCompare(b.name))) {
      const allSkills = await db.select().from(skills)
        .where(eq(skills.areaId, area.id))
        .orderBy(asc(skills.level), asc(skills.levelPosition));

      if (allSkills.length === 0) continue;

      let areaValid = true;

      for (let level = 1; level <= 20; level++) {
        const levelSkills = allSkills.filter(s => s.level === level);
        if (levelSkills.length === 0) continue;

        const availableCount = levelSkills.filter(s => s.status === 'available').length;
        const isUnlocked = level <= area.unlockedLevel;
        const expectedAvailable = isUnlocked ? 1 : 0;

        if (availableCount !== expectedAvailable) {
          areaValid = false;
          allValid = false;
        }
      }

      if (areaValid) {
        validAreas++;
        console.log(`✅ ${area.name} (${area.id})`);
      } else {
        console.log(`❌ ${area.name} (${area.id})`);
      }
    }

    console.log(`\n✅ ${validAreas}/${allAreas.length} areas are valid\n`);

    if (allValid) {
      console.log('🎉 ALL ENTITIES FIXED!');
    }

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
})();
