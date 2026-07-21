const fs = require('fs');
const content = fs.readFileSync('server.js', 'utf8');

const newContent = content.replace(
    /\[\'300\', \'720\', \'1080\'\]\.forEach\(size => \{/,
    "['300', '600', '720', '1080'].forEach(size => {"
);

fs.writeFileSync('server.js', newContent);
console.log('Patched server.js folders');
