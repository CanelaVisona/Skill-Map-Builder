import { db } from "./server/db";
import { areas, skills, projects } from "@shared/schema";
import { eq } from "drizzle-orm";

async function recalculateAllStatuses() {
  console.log("🔄 Recalculando statuses para TODAS las áreas y proyectos...\n");
  
  try {
    // Get all areas
    const allAreas = await db.select().from(areas);
    let fixedCount = 0;
    
    console.log(`[Areas] Procesando ${allAreas.length} áreas...\n`);
    
    for (const area of allAreas) {
      const unlockedLevel = area.unlockedLevel || 1;
      
      // Get all skills in the area
      const allSkills = await db.select().from(skills)
        .where(eq(skills.areaId, area.id));
      
      if (allSkills.length === 0) continue;
      
      // Group by level
      const skillsByLevel = new Map();
      for (const skill of allSkills) {
        const lv = skill.level || 1;
        if (!skillsByLevel.has(lv)) skillsByLevel.set(lv, []);
        skillsByLevel.get(lv).push(skill);
      }
      
      // Process each level
      for (const [lvl, lvlSkills] of skillsByLevel) {
        const sortedByPosition = [...lvlSkills].sort((a, b) => 
          (a.levelPosition || 0) - (b.levelPosition || 0)
        );
        
        let foundFirstAvailable = false;
        
        for (const skill of sortedByPosition) {
          let newStatus: "mastered" | "available" | "locked";
          
          if (lvl < unlockedLevel) {
            newStatus = "mastered";
          } else if (lvl === unlockedLevel) {
            if (skill.levelPosition === 1) {
              newStatus = "mastered";
            } else if (!foundFirstAvailable && skill.status !== "mastered") {
              newStatus = "available";
              foundFirstAvailable = true;
            } else {
              newStatus = "locked";
            }
          } else {
            newStatus = "locked";
          }
          
          if (skill.status !== newStatus) {
            await db.update(skills)
              .set({ status: newStatus })
              .where(eq(skills.id, skill.id));
            fixedCount++;
            console.log(`  ✓ ${area.name} Nivel ${lvl}: "${skill.title || "(empty)"}" ${skill.status} → ${newStatus}`);
          }
        }
      }
    }
    
    console.log(`\n[Projects] Procesando proyectos...\n`);
    const allProjects = await db.select().from(projects);
    
    for (const project of allProjects) {
      const unlockedLevel = project.unlockedLevel || 1;
      
      // Get all skills in the project
      const allSkills = await db.select().from(skills)
        .where(eq(skills.projectId, project.id));
      
      if (allSkills.length === 0) continue;
      
      // Group by level
      const skillsByLevel = new Map();
      for (const skill of allSkills) {
        const lv = skill.level || 1;
        if (!skillsByLevel.has(lv)) skillsByLevel.set(lv, []);
        skillsByLevel.get(lv).push(skill);
      }
      
      // Process each level
      for (const [lvl, lvlSkills] of skillsByLevel) {
        const sortedByPosition = [...lvlSkills].sort((a, b) => 
          (a.levelPosition || 0) - (b.levelPosition || 0)
        );
        
        let foundFirstAvailable = false;
        
        for (const skill of sortedByPosition) {
          let newStatus: "mastered" | "available" | "locked";
          
          if (lvl < unlockedLevel) {
            newStatus = "mastered";
          } else if (lvl === unlockedLevel) {
            if (skill.levelPosition === 1) {
              newStatus = "mastered";
            } else if (!foundFirstAvailable && skill.status !== "mastered") {
              newStatus = "available";
              foundFirstAvailable = true;
            } else {
              newStatus = "locked";
            }
          } else {
            newStatus = "locked";
          }
          
          if (skill.status !== newStatus) {
            await db.update(skills)
              .set({ status: newStatus })
              .where(eq(skills.id, skill.id));
            fixedCount++;
            console.log(`  ✓ ${project.name} Nivel ${lvl}: "${skill.title || "(empty)"}" ${skill.status} → ${newStatus}`);
          }
        }
      }
    }
    
    console.log(`\n✅ Recalculación completada. ${fixedCount} nodos corregidos.`);
  } catch (err) {
    console.error("❌ Error:", err);
  }
  process.exit(0);
}

recalculateAllStatuses();
