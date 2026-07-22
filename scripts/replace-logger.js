import fs from 'fs';
import path from 'path';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

const apiFiles = walk('./app/api');

apiFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  if (content.includes('console.error(') || content.includes('console.log(') || content.includes('console.warn(')) {
    // Add import if not present
    if (!content.includes("import { logger } from")) {
      // calculate relative path to lib/logger
      const depth = file.split('/').length - 2; // app/api/file.ts -> 2. app/api/auth/route.ts -> 3
      const prefix = depth === 1 ? '../lib/logger' : '../'.repeat(depth - 1) + 'lib/logger';
      content = `import { logger } from '${prefix}';\n` + content;
    }

    content = content.replace(/console\.error\(/g, 'logger.error(');
    content = content.replace(/console\.log\(/g, 'logger.info(');
    content = content.replace(/console\.warn\(/g, 'logger.warn(');
    
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
