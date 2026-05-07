import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './shared/schema';

const { areas, projects } = schema;

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool, { schema });

(async () => {
  try {
    // Get all areas
    const allAreas = await db.select().from(areas);
    
    console.log(`📊 AREAS IN DATABASE:\n`);
    console.log(`Total: ${allAreas.length} areas\n`);

    // Group by name
    const byName = new Map<string, typeof allAreas>();
    for (const area of allAreas) {
      if (!byName.has(area.name)) {
        byName.set(area.name, []);
      }
      byName.get(area.name)!.push(area);
    }

    for (const [name, areas] of Array.from(byName.entries()).sort()) {
      if (areas.length === 1) {
        console.log(`✅ ${name}`);
        console.log(`   ID: ${areas[0].id}`);
        console.log(`   unlockedLevel: ${areas[0].unlockedLevel}\n`);
      } else {
        console.log(`⚠️  ${name} (${areas.length} entries)`);
        areas.forEach((a, idx) => {
          console.log(`   [${idx + 1}] ID: ${a.id} | unlockedLevel: ${a.unlockedLevel}`);
        });
        console.log();
      }
    }

    // Get all projects
    const allProjects = await db.select().from(projects);
    
    console.log(`\n📊 PROJECTS IN DATABASE:\n`);
    console.log(`Total: ${allProjects.length} projects\n`);

    // Group by name
    const projByName = new Map<string, typeof allProjects>();
    for (const proj of allProjects) {
      if (!projByName.has(proj.name)) {
        projByName.set(proj.name, []);
      }
      projByName.get(proj.name)!.push(proj);
    }

    for (const [name, projects] of Array.from(projByName.entries()).sort()) {
      if (projects.length === 1) {
        console.log(`✅ ${name}`);
        console.log(`   ID: ${projects[0].id}`);
        console.log(`   unlockedLevel: ${projects[0].unlockedLevel}\n`);
      } else {
        console.log(`⚠️  ${name} (${projects.length} entries)`);
        projects.forEach((p, idx) => {
          console.log(`   [${idx + 1}] ID: ${p.id} | unlockedLevel: ${p.unlockedLevel}`);
        });
        console.log();
      }
    }

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
