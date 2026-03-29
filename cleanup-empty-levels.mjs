import Database from 'better-sqlite3';

const db = new Database('./data.db');

try {
  // Get all areas with their skills
  const areas = db.prepare('SELECT id, name FROM areas').all();
  
  for (const area of areas) {
    // Get all skills for this area
    const skills = db.prepare('SELECT id, level FROM skills WHERE area_id = ?').all(area.id);
    
    // Group by level
    const levelMap = new Map();
    skills.forEach(s => {
      if (!levelMap.has(s.level)) levelMap.set(s.level, []);
      levelMap.get(s.level).push(s.id);
    });
    
    // Calculate targetNextLevel (= unlockedLevel + 3)
    const areaData = db.prepare('SELECT unlocked_level FROM areas WHERE id = ?').get(area.id);
    const targetNextLevel = areaData.unlocked_level + 3;
    
    console.log(`\n${area.name}: unlockedLevel=${areaData.unlocked_level}, targetNextLevel=${targetNextLevel}`);
    console.log(`  Levels found: ${Array.from(levelMap.keys()).sort((a,b) => a-b).join(', ')}`);
    
    // Delete skills beyond targetNextLevel
    const levelsToDelete = Array.from(levelMap.keys()).filter(l => l > targetNextLevel);
    if (levelsToDelete.length > 0) {
      console.log(`  Deleting levels: ${levelsToDelete.join(', ')}`);
      for (const level of levelsToDelete) {
        const skillIds = levelMap.get(level);
        for (const id of skillIds) {
          console.log(`    - Deleting skill ${id} from level ${level}`);
          db.prepare('DELETE FROM skills WHERE id = ?').run(id);
        }
      }
    } else {
      console.log(`  ✓ No levels to delete`);
    }
  }
  
  db.close();
  console.log('\n✓ Cleanup complete!');
} catch (error) {
  console.error('Error:', error);
  db.close();
}
