import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { skills, areas, projects } from './shared/schema';
import { eq, and, asc } from 'drizzle-orm';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

async function recalculateAvailableStatus(
  level: number,
  options: { areaId?: string; projectId?: string }
) {
  const { areaId, projectId } = options;

  const levelSkills = await db.select().from(skills).where(
    and(
      eq(skills.level, level),
      areaId ? eq(skills.areaId, areaId) : undefined,
      projectId ? eq(skills.projectId, projectId) : undefined
    )
  ).orderBy(asc(skills.levelPosition));

  if (levelSkills.length === 0) return;

  // Ensure auto-complete are mastered
  for (const skill of levelSkills) {
    if (skill.isAutoComplete === 1 && skill.status !== "mastered") {
      await db.update(skills).set({ status: "mastered" }).where(eq(skills.id, skill.id));
    }
  }

  // Find first non-mastered
  let firstNonMasteredIndex = -1;
  for (let i = 0; i < levelSkills.length; i++) {
    if (levelSkills[i].status !== "mastered") {
      firstNonMasteredIndex = i;
      break;
    }
  }

  // Update all statuses
  for (let i = 0; i < levelSkills.length; i++) {
    const skill = levelSkills[i];
    let newStatus: "mastered" | "available" | "locked";
    
    if (skill.status === "mastered") {
      newStatus = "mastered";
    } else if (i === firstNonMasteredIndex && firstNonMasteredIndex !== -1) {
      newStatus = "available";
    } else {
      newStatus = "locked";
    }

    if (skill.status !== newStatus) {
      await db.update(skills).set({ status: newStatus }).where(eq(skills.id, skill.id));
    }
  }
}

async function scanAndFixAllAreas() {
  console.log('=== SCANNING ALL AREAS & PROJECTS FOR MULTIPLE AVAILABLE NODES ===\n');

  // Get all areas
  const allAreas = await db.select().from(areas);
  console.log(`Found ${allAreas.length} areas\n`);

  let problemsFound = 0;
  let problemsFixed = 0;

  for (const area of allAreas) {
    const areaSkills = await db.select().from(skills).where(eq(skills.areaId, area.id));
    
    // Group by level
    const levelGroups = new Map<number, typeof areaSkills>();
    for (const skill of areaSkills) {
      if (!levelGroups.has(skill.level)) {
        levelGroups.set(skill.level, []);
      }
      levelGroups.get(skill.level)!.push(skill);
    }

    // Check each level
    for (const [level, levelSkills] of levelGroups.entries()) {
      const availableCount = levelSkills.filter(s => s.status === 'available').length;
      
      if (availableCount > 1) {
        problemsFound++;
        console.log(`❌ PROBLEM FOUND - Area "${area.name}" (${area.id}) Level ${level}:`);
        console.log(`   Found ${availableCount} available nodes (should be 1)`);
        
        // Fix it
        await recalculateAvailableStatus(level, { areaId: area.id });
        problemsFixed++;
        
        // Verify fix
        const fixedSkills = await db.select().from(skills).where(
          and(eq(skills.areaId, area.id), eq(skills.level, level))
        );
        const fixedAvailableCount = fixedSkills.filter(s => s.status === 'available').length;
        console.log(`   ✅ FIXED - Now has ${fixedAvailableCount} available node(s)\n`);
      }
    }
  }

  // Get all projects
  const allProjects = await db.select().from(projects);
  console.log(`\nFound ${allProjects.length} projects\n`);

  for (const project of allProjects) {
    const projectSkills = await db.select().from(skills).where(eq(skills.projectId, project.id));
    
    // Group by level
    const levelGroups = new Map<number, typeof projectSkills>();
    for (const skill of projectSkills) {
      if (!levelGroups.has(skill.level)) {
        levelGroups.set(skill.level, []);
      }
      levelGroups.get(skill.level)!.push(skill);
    }

    // Check each level
    for (const [level, levelSkills] of levelGroups.entries()) {
      const availableCount = levelSkills.filter(s => s.status === 'available').length;
      
      if (availableCount > 1) {
        problemsFound++;
        console.log(`❌ PROBLEM FOUND - Project "${project.name}" (${project.id}) Level ${level}:`);
        console.log(`   Found ${availableCount} available nodes (should be 1)`);
        
        // Fix it
        await recalculateAvailableStatus(level, { projectId: project.id });
        problemsFixed++;
        
        // Verify fix
        const fixedSkills = await db.select().from(skills).where(
          and(eq(skills.projectId, project.id), eq(skills.level, level))
        );
        const fixedAvailableCount = fixedSkills.filter(s => s.status === 'available').length;
        console.log(`   ✅ FIXED - Now has ${fixedAvailableCount} available node(s)\n`);
      }
    }
  }

  console.log('\n=== SCAN COMPLETE ===');
  console.log(`Problems found: ${problemsFound}`);
  console.log(`Problems fixed: ${problemsFixed}`);
  
  if (problemsFound === 0) {
    console.log('\n✅ All areas and projects are clean! No multiple available nodes found.');
  }

  process.exit(0);
}

scanAndFixAllAreas().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
