const fs = require('fs');
const content = fs.readFileSync('server.js', 'utf8');

const newContent = content.replace(
    "} else if (req.originalUrl.startsWith('/api/') && !req.originalUrl.startsWith('/api/media/stream') && process.env.NODE_ENV !== 'development') {",
    "} else if (req.originalUrl.startsWith('/api/') && !req.originalUrl.startsWith('/api/media/stream') && !req.originalUrl.startsWith('/api/settings/logo') && !req.originalUrl.startsWith('/api/security/trace') && process.env.NODE_ENV !== 'development') {"
);

fs.writeFileSync('server.js', newContent);
console.log('Patched server.js middleware');
