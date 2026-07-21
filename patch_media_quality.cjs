const fs = require('fs');
const content = fs.readFileSync('server/routes/media.js', 'utf8');

const newContent = content.replace(
    /processVariant\(1080, 'webp', 85\),\s*processVariant\(300, 'webp', 80\)/,
    "processVariant(1080, 'webp', 95),\n              processVariant(600, 'webp', 90)"
);

fs.writeFileSync('server/routes/media.js', newContent);
console.log('Patched media.js for better quality');
