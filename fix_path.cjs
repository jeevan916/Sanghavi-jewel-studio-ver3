const fs = require('fs');
let content = fs.readFileSync('server/routes/media.js', 'utf8');

content = content.replace("['scripts/enhance.py']", "[path.resolve(process.cwd(), 'scripts/enhance.py')]");

fs.writeFileSync('server/routes/media.js', content);
