const fs = require('fs');
let content = fs.readFileSync('server/routes/admin.js', 'utf8');

// replace the inner require calls I just added
content = content.replace(/const fs = require\('fs'\);/g, '');
content = content.replace(/const path = require\('path'\);/g, '');
content = content.replace(/__dirname/g, 'import.meta.dirname');

fs.writeFileSync('server/routes/admin.js', content);
console.log('Fixed admin.js');
