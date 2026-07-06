const fs = require('fs');

let mediaJs = fs.readFileSync('server/routes/media.js', 'utf8');
mediaJs = mediaJs.replace("match(/^data:(image\\\\/[a-zA-Z0-9+-]+);base64,(.+)$/)", "match(/^data:([a-zA-Z0-9+\\\\/\\-]+);base64,(.+)$/)");
fs.writeFileSync('server/routes/media.js', mediaJs);

let serverJs = fs.readFileSync('server.js', 'utf8');
serverJs = serverJs.replace(/img\.startsWith\('data:image'\)/g, "img.startsWith('data:')");
fs.writeFileSync('server.js', serverJs);
console.log('Fixed regex!');
