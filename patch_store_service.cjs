const fs = require('fs');
let content = fs.readFileSync('src/services/storeService.ts', 'utf-8');

content = content.replace(
    /deleteBackup: \(name: string\) => apiFetch\(`\/backups\/\$\{name\}`\, \{ method: 'DELETE' \}\),/,
    `deleteBackup: (name: string) => apiFetch(\`/backups/\${name}\`, { method: 'DELETE' }),\n  restoreBackup: (name: string) => apiFetch(\`/backups/restore/\${name}\`, { method: 'POST' }),`
);

fs.writeFileSync('src/services/storeService.ts', content);
