import { db } from "./server/db.js";
import { areas, skills, projects } from "@shared/schema.js";
import { eq } from "drizzle-orm";

async function checkStatuses() {
  // Get all areas
  const allAreas = await db.select().from(areas);
  
  console.log("\n=== AREAS STATUS ===");
  for (const area of allAreas) {
    console.log(`\n${area.name} (unlockedLevel: ${area.unlockedLevel})`);
    
    const areaSkills = await db.select().from(skills)
      .where(eq(skills.areaId, area.id));
    
    // Group by level
    const byLevel = {};
    for (const skill of areaSkills) {
      if (!byLevel[skill.level]) byLevel[skill.level] = [];
      byLevel[skill.level].push({ title: skill.title || "(empty)", status: skill.status, levelPosition: skill.levelPosition });
    }
    
    for (const [level, lvlSkills] of Object.entries(byLevel).sort((a, b) => a[0] - b[0])) {
      const availableCount = lvlSkills.filter(s => s.status === "available").length;
      const masteredCount = lvlSkills.filter(s => s.status === "mastered").length;
      const lockedCount = lvlSkills.filter(s => s.status === "locked").length;
      console.log(`  Nivel ${level}: ${masteredCount}M + ${availableCount}A + ${lockedCount}L`);
      if (availableCount > 0) {
        lvlSkills.forEach(s => {
          if (s.status === "available") {
            console.log(`    ⚠️  AVAILABLE: "${s.title}" (pos ${s.levelPosition})`);
          }
        });
      }
    }
  }
  
  console.log("\n=== PROJECTS STATUS ===");
  const allProjects = await db.select().from(projects);
  for (const project of allProjects) {
    console.log(`\n${project.name} (unlockedLevel: ${project.unlockedLevel})`);
    
    const projSkills = await db.select().from(skills)
      .where(eq(skills.projectId, project.id));
    
    // Group by level
    const byLevel = {};
    for (const skill of projSkills) {
      if (!byLevel[skill.level]) byLevel[skill.level] = [];
      byLevel[skill.level].push({ title: skill.title || "(empty)", status: skill.status, levelPosition: skill.levelPosition });
    }
    
    for (const [level, lvlSkills] of Object.entries(byLevel).sort((a, b) => a[0] - b[0])) {
      const availableCount = lvlSkills.filter(s => s.status === "available").length;
      const masteredCount = lvlSkills.filter(s => s.status === "mastered").length;
      const lockedCount = lvlSkills.filter(s => s.status === "locked").length;
      console.log(`  Nivel ${level}: ${masteredCount}M + ${availableCount}A + ${lockedCount}L`);
      if (availableCount > 0) {
        lvlSkills.forEach(s => {
          if (s.status === "available") {
            console.log(`    ⚠️  AVAILABLE: "${s.title}" (pos ${s.levelPosition})`);
          }
        });
      }
    }
  }
  
  process.exit(0);
}

checkStatuses().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
