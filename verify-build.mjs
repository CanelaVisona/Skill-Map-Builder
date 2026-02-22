import { execSync } from 'child_process';
import fs from 'fs';

try {
  console.log('Building...');
  execSync('npm run build', { 
    cwd: process.cwd(),
    stdio: 'inherit'
  });
  console.log('✅ Build successful');
  fs.writeFileSync('build_success.txt', 'Build was successful');
} catch (err) {
  console.error('❌ Build failed:', err.message);
  fs.writeFileSync('build_error.txt', err.message);
  process.exit(1);
}
