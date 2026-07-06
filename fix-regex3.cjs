const fs = require('fs');

let mediaJs = fs.readFileSync('server/routes/media.js', 'utf8');

mediaJs = mediaJs.replace(/const matches = imgStr\.match\(.+;/g, "const matches = imgStr.match(/^data:([a-zA-Z0-9+\\\\/\\\\-]+);base64,(.+)$/);");

fs.writeFileSync('server/routes/media.js', mediaJs);
console.log('Fixed regex 3!');
