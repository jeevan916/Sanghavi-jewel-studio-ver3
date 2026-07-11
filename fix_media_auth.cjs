const fs = require('fs');
let content = fs.readFileSync('server/routes/media.js', 'utf8');

const oldLogic = `  const requireStaff = (req, res, next) => {
      if (!req.user || !['admin', 'staff', 'manager'].includes(req.user.role)) {
          return res.status(401).json({ error: 'Unauthorized: Missing credentials' });
      }
      next();
  };`;

if (content.includes(oldLogic)) {
    content = content.replace(oldLogic, '');
    
    // Add import if not present
    if (!content.includes("import { requireStaff } from '../auth.js';")) {
        content = content.replace("import crypto from 'crypto';", "import crypto from 'crypto';\nimport { requireStaff } from '../auth.js';");
    }
    
    fs.writeFileSync('server/routes/media.js', content);
    console.log("Fixed media auth successfully!");
} else {
    console.log("Could not find TargetContent");
}
