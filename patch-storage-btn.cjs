const fs = require('fs');

let content = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

const target = `                    <div className="border-t border-stone-100 pt-6">
                        <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-4">Storage Formats & Engine</p>`;

const replacement = `                    <div className="border-t border-stone-100 pt-6">
                        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between mb-4">
                            <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Storage Formats & Engine</p>
                            <button
                                onClick={async () => {
                                    try {
                                        const res = await apiFetch('/api/admin/migrate-blobs', { method: 'POST' });
                                        alert(res.message || 'Migration successful');
                                    } catch (e: any) {
                                        alert('Migration failed: ' + e.message);
                                    }
                                }}
                                className="px-4 py-2 bg-brand-dark text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-gold transition-colors flex items-center gap-2"
                            >
                                <RefreshCw size={14} /> Migrate Blobs to Disk
                            </button>
                        </div>`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync('src/pages/AdminDashboard.tsx', content);
    console.log("Patched StorageView with migrate button.");
} else {
    console.error("Target not found");
}
