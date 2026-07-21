const fs = require('fs');
const content = fs.readFileSync('server.js', 'utf8');

const replacement = `await pool.query(\`CREATE TABLE IF NOT EXISTS whatsapp_templates (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) UNIQUE,
        category VARCHAR(100),
        body_text TEXT,
        buttons JSON,
        sample_variables JSON,
        status VARCHAR(50) DEFAULT 'draft',
        is_synced BOOLEAN DEFAULT FALSE,
        createdAt DATETIME,
        updatedAt DATETIME
    )\`);`;

const newContent = content.replace(
    /await pool\.query\(`CREATE TABLE IF NOT EXISTS whatsapp_templates \([\s\S]*?updatedAt DATETIME\s*\)`\);/,
    replacement
);

fs.writeFileSync('server.js', newContent);
console.log('Patched server.js schema');
