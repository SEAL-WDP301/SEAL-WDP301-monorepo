const fs = require('fs');
const path = require('path');

function replaceImports(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      replaceImports(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // For [eventId]/page.tsx
      if (dir.endsWith('[eventId]')) {
         content = content.replace(/from ["']\.\/_components/g, 'from "../../_components');
      } 
      // For sub-directories like [eventId]/feedback/page.tsx
      else {
         content = content.replace(/from ["']\.\.\/_components/g, 'from "../../../_components');
      }
      
      // Also update links inside pages!
      // E.g., href="/mentor/teams" -> href={`/mentor/events/${eventId}/teams`}
      // This is a bit tricky, so let's only fix the _components imports for now.
      
      fs.writeFileSync(fullPath, content);
    }
  }
}

replaceImports('./app/mentor/events/[eventId]');
console.log('Fixed imports in mentor events');
