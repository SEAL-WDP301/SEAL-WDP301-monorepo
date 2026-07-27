const fs = require('fs');
const path = require('path');

function fixDeepImports(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      fixDeepImports(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      let changed = false;
      // Fix ../../_components -> ../../../../_components for [teamId]/page.tsx
      if (content.includes('from "../../_components')) {
        content = content.replace(/from "\.\.\/\.\.\/_components/g, 'from "../../../../_components');
        changed = true;
      }
      
      // Fix ../../../_components -> ../../../../../_components for [teamId]/submissions/[submissionId]/page.tsx
      if (content.includes('from "../../../_components')) {
        content = content.replace(/from "\.\.\/\.\.\/\.\.\/_components/g, 'from "../../../../../_components');
        changed = true;
      }
      
      if (changed) {
        fs.writeFileSync(fullPath, content);
      }
    }
  }
}
fixDeepImports('./app/mentor/events/[eventId]/teams');
console.log('Fixed deep imports');
