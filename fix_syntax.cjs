const fs = require('fs');
let content = fs.readFileSync('server/routes/media.js', 'utf8');

const newContent = content.substring(0, content.indexOf("    }});") + 8) + "\n    return router;\n}\n";

fs.writeFileSync('server/routes/media.js', newContent);
