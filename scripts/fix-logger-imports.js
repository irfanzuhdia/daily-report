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
  if (content.includes('import { logger } from \'..')) {
    content = content.replace(/import \{ logger \} from '(\.\.\/)+lib\/logger';/g, "import { logger } from '@/lib/logger';");
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Fixed import in ${file}`);
  }
});
