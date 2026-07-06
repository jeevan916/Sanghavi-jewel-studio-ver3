const fs = require('fs');
let serverJs = fs.readFileSync('server.js', 'utf8');
serverJs = serverJs.replace(/copyFileSync/g, 'fs.copyFileSync');
fs.writeFileSync('server.js', serverJs);
console.log('Fixed fs in server.js');
