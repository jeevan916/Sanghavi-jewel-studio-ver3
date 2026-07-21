const fs = require('fs');
let content = fs.readFileSync('server/backupService.js', 'utf8');

// Replace the archiver require with dynamic import or just standard import
content = content.replace("import { createRequire } from 'module';\nconst require = createRequire(import.meta.url);\nconst archiver = require('archiver');", "import { ZipArchive } from 'archiver';");

content = content.replace("const archive = archiver('zip', { zlib: { level: 9 } });", "const archive = new ZipArchive({ zlib: { level: 9 } });");

fs.writeFileSync('server/backupService.js', content);
console.log('Fixed archiver');
