const fs = require('fs');
let content = fs.readFileSync('server/backupService.js', 'utf8');
content = content.replace("import archiver from 'archiver';", "import { createRequire } from 'module';\nconst require = createRequire(import.meta.url);\nconst archiver = require('archiver');");
content = content.replace("import mysqldump from 'mysqldump';", "const mysqldump = require('mysqldump');");
fs.writeFileSync('server/backupService.js', content);
console.log('Fixed imports');
