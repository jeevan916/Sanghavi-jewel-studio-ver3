const fs = require('fs');
let content = fs.readFileSync('server/routes/admin.js', 'utf8');

content = content.replace("    });\n\n        }\n    });\n\n    return router;", "    });\n\n    return router;");
fs.writeFileSync('server/routes/admin.js', content);
