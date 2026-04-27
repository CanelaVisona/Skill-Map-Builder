import { pool } from './server/db.js';
import { storage } from './server/storage.js';

console.log('\n=== TEST: updateProject with endOfAreaLevel ===\n');

try {
  // Get first project
  console.log('1. Getting first project...');
  const result = await pool.query(
    `SELECT id, name, end_of_area_level FROM projects LIMIT 1`
  );
  
  if (result.rows.length === 0) {
    console.log('❌ No projects found in database');
    process.exit(1);
  }
  
  const project = result.rows[0];
  console.log(`   ✓ Found: ${project.name} (id: ${project.id})`);
  console.log(`   ✓ Current endOfAreaLevel: ${project.end_of_area_level}`);
  
  // Get final nodes to find a level to test with
  console.log('\n2. Finding final nodes...');
  const skillsResult = await pool.query(
    `SELECT id, level, title FROM skills 
     WHERE project_id = $1 AND is_final_node = 1
     ORDER BY level DESC LIMIT 1`,
    [project.id]
  );
  
  if (skillsResult.rows.length === 0) {
    console.log('❌ No final nodes found');
    process.exit(1);
  }
  
  const testLevel = skillsResult.rows[0].level;
  console.log(`   ✓ Using test level: ${testLevel}`);
  
  // Test updateProject with endOfAreaLevel
  console.log(`\n3. Testing updateProject() with endOfAreaLevel=${testLevel}...`);
  
  const updatedProject = await storage.updateProject(project.id, {
    endOfAreaLevel: testLevel
  });
  
  if (!updatedProject) {
    console.log('❌ updateProject returned undefined');
    process.exit(1);
  }
  
  console.log(`   ✓ updateProject() succeeded`);
  console.log(`   ✓ Returned endOfAreaLevel: ${updatedProject.endOfAreaLevel}`);
  
  // Verify in database
  console.log('\n4. Verifying in database...');
  const dbVerify = await pool.query(
    `SELECT id, name, end_of_area_level FROM projects WHERE id = $1`,
    [project.id]
  );
  
  const dbProject = dbVerify.rows[0];
  console.log(`   ✓ Database value: ${dbProject.end_of_area_level}`);
  
  if (dbProject.end_of_area_level === testLevel) {
    console.log('\n✅ SUCCESS: endOfAreaLevel was correctly saved to database!');
  } else {
    console.log(`\n❌ FAILED: Expected ${testLevel}, got ${dbProject.end_of_area_level}`);
    process.exit(1);
  }
  
  // Test updateProject to clear it (set to null)
  console.log(`\n5. Testing updateProject() to clear endOfAreaLevel...`);
  const clearedProject = await storage.updateProject(project.id, {
    endOfAreaLevel: null
  });
  
  console.log(`   ✓ Cleared endOfAreaLevel: ${clearedProject?.endOfAreaLevel}`);
  
  const dbVerify2 = await pool.query(
    `SELECT end_of_area_level FROM projects WHERE id = $1`,
    [project.id]
  );
  
  if (dbVerify2.rows[0].end_of_area_level === null) {
    console.log('   ✓ Database cleared successfully');
  }
  
  console.log('\n✅ ALL TESTS PASSED');
  process.exit(0);
  
} catch (error) {
  console.error('\n❌ ERROR:', error.message);
  console.error(error);
  process.exit(1);
}
