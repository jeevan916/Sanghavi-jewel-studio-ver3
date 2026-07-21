const fs = require('fs');
let content = fs.readFileSync('src/components/admin/WhatsAppManagementPanel.tsx', 'utf8');

const oldReplacement = `                              {{\`\${vIdx+1}\`}}: {v}`;
const newReplacement = `                              {"{{"}{vIdx+1}{"}}"}: {v}`;

content = content.replace(oldReplacement, newReplacement);
fs.writeFileSync('src/components/admin/WhatsAppManagementPanel.tsx', content);
console.log('Fixed syntax error');
