import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

try {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const dbPath = path.join(__dirname, 'db.sqlite');

  console.log('Opening database at:', dbPath);
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  // Check table structure
  const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all();
  console.log('Tables in DB:', tables.map(t => t.name));

  // Get all locked skills
  const lockedSkills = db.prepare(`
    SELECT 
      id,
      title,
      level,
      y,
      status,
      levelPosition,
      "areaId",
      "projectId"
    FROM skills
    WHERE status = 'locked'
    ORDER BY level, y
  `).all();

  console.log('\n=== LOCKED SKILLS ===');
  console.log(`Found ${lockedSkills.length} locked skills\n`);

  if (lockedSkills.length === 0) {
    console.log('No locked skills in database');
    console.log('\nChecking all skills with their status:');
    const allSkills = db.prepare(`
      SELECT id, title, level, status, levelPosition FROM skills LIMIT 20
    `).all();
    allSkills.forEach(s => {
      console.log(`- "${s.title}" (level: ${s.level}, status: ${s.status}, position: ${s.levelPosition})`);
    });
  } else {
    lockedSkills.forEach(skill => {
      console.log(`"${skill.title}" | Level: ${skill.level}, Pos: ${skill.levelPosition} | Area: ${skill.areaId}, Project: ${skill.projectId}`);
    });
  }

  db.close();
} catch (err) {
  console.error('Error:', err.message);
  console.error(err.stack);
}
