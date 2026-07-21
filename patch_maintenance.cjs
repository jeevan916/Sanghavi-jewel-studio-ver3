const fs = require('fs');
let content = fs.readFileSync('src/pages/Maintenance.tsx', 'utf-8');

const restoreLogic = `
  const handleRestoreBackup = async (name: string) => {
    const confirm = window.prompt("WARNING: Restoring will overwrite all current database data. Type 'RESTORE' to confirm.");
    if (confirm !== 'RESTORE') return;
    
    addLog(\`Restoring backup: \${name}...\`);
    try {
      await storeService.restoreBackup(name);
      addLog(\`Restore complete! Please reload the app.\`);
      alert("Restore complete! The page will now reload.");
      window.location.reload();
    } catch (e: any) {
      addLog(\`Restore error: \${e.message}\`);
      alert("Restore failed: " + e.message);
    }
  };
`;

content = content.replace(
    /const handleDeleteBackup = async \(name: string\) => \{/,
    restoreLogic + '\n  const handleDeleteBackup = async (name: string) => {'
);

content = content.replace(
    /<a href=\{storeService\.downloadBackupUrl\(b\.name\)\} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Download ZIP"><Download size=\{22\}\/><\/a>/,
    `<a href={storeService.downloadBackupUrl(b.name)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Download ZIP"><Download size={22}/></a>\n                <button onClick={() => handleRestoreBackup(b.name)} className="p-2 text-orange-400 hover:bg-orange-50 rounded-lg transition-colors" title="Restore Backup"><RefreshCw size={22}/></button>`
);

content = content.replace(
    /import \{ [^}]* \} from 'lucide-react';/,
    match => {
        if (!match.includes('RefreshCw')) {
            return match.replace('lucide-react', '').replace('}', ', RefreshCw } from \'lucide-react\'');
        }
        return match;
    }
);

fs.writeFileSync('src/pages/Maintenance.tsx', content);
