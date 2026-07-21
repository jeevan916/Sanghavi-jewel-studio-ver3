const fs = require('fs');
let content = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

if (!content.includes('SystemBackupsPanel')) {
    content = content.replace(
        "import { WhatsAppManagementPanel } from '@/components/admin/WhatsAppManagementPanel.tsx';",
        "import { WhatsAppManagementPanel } from '@/components/admin/WhatsAppManagementPanel.tsx';\nimport { SystemBackupsPanel } from '@/components/admin/SystemBackupsPanel.tsx';"
    );
    content = content.replace(
        "<MigrationDebugger />",
        "<MigrationDebugger />\n                    <SystemBackupsPanel />"
    );
    fs.writeFileSync('src/pages/AdminDashboard.tsx', content);
    console.log('Patched AdminDashboard.tsx');
}
