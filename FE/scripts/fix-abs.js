const fs = require('fs');
const path = require('path');

function replaceWithAbsolute(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      replaceWithAbsolute(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      const newContent = content.replace(/from ["'](\.\.\/)+_components/g, 'from "@/app/mentor/_components');
      
      if (content !== newContent) {
        fs.writeFileSync(fullPath, newContent);
      }
    }
  }
}
replaceWithAbsolute('./app/mentor/events');
console.log('Fixed imports to absolute paths');
