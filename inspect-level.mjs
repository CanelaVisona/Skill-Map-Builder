import { neon } from '@neondatabase/serverless';

const dbUrl = 'postgresql://neondb_owner:npg_QOqBSy0zVt5R@ep-rapid-band-ahn7lyss-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = neon(dbUrl);

// Inspect one broken level
const skills = await sql`
  SELECT id, level_position, status, title
  FROM skills
  WHERE area_id = 'casa_limpia' AND level = 4
  ORDER BY level_position;
`;

console.log('Casa Limpia, Level 4:');
skills.forEach(s => {
  console.log(`  Pos ${s.level_position}: ${s.status.padEnd(10)} - ${s.title}`);
});

console.log('\nLooks like:');
console.log('- Position 1 should be mastered');
console.log('- First non-mastered should be available');
console.log('- Rest should be locked');

process.exit(0);
