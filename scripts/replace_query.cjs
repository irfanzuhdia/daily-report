const fs = require('fs');
const path = require('path');

const repoPath = path.join(process.cwd(), 'lib/repositories');
const files = fs.readdirSync(repoPath).filter(f => f.endsWith('.ts'));

for (const file of files) {
  const filePath = path.join(repoPath, file);
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('(sql as any).query')) {
    content = content.replace(/\(sql as any\)\.query/g, 'sql.unsafe');
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Replaced in ${file}`);
  }
}
