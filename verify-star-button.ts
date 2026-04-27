import { pool } from './server/db';

console.log('\n=== VERIFYING STAR BUTTON FIX ===\n');

try {
  const result = await pool.query(
    `SELECT id, name, end_of_area_level FROM projects WHERE id = 'aad71ab0-276c-4465-8473-d4cddace84a0'`
  );
  
  if (result.rows.length === 0) {
    console.log('❌ Project not found');
    process.exit(1);
  }
  
  const project = result.rows[0];
  console.log('Project ID: ' + project.id);
  console.log('Project Name: ' + project.name);
  console.log('end_of_area_level: ' + project.end_of_area_level);
  
  if (project.end_of_area_level !== null) {
    console.log('\n✅ SUCCESS: Star button is working! endOfAreaLevel is saved.');
  } else {
    console.log('\n⚠️  endOfAreaLevel is still null. Star button may not have been clicked yet.');
  }
  
  await pool.end();
  process.exit(0);
} catch (error) {
  console.error('❌ ERROR:', error.message);
  process.exit(1);
}
