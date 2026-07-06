const fs = require('fs');

let mediaJs = fs.readFileSync('server/routes/media.js', 'utf8');

mediaJs = mediaJs.replace(/if \(!imgStr\.startsWith\('data:image'\)\) {/, "if (!imgStr.startsWith('data:')) {");

fs.writeFileSync('server/routes/media.js', mediaJs);
console.log('Fixed stream video!');
