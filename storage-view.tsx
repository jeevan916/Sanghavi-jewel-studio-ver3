const StorageView = () => {
    const [storageConfig, setStorageConfig] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStorageConfig = async () => {
            try {
                const res = await apiFetch('/api/admin/storage-config');
                setStorageConfig(res);
            } catch (e) {
                console.error('Failed to fetch storage config:', e);
            } finally {
                setLoading(false);
            }
        };
        fetchStorageConfig();
    }, []);

    if (loading) return <div className="p-8 text-center text-stone-500 animate-pulse">Loading Storage Configuration...</div>;
    if (!storageConfig) return <div className="p-8 text-center text-brand-red">Failed to load storage configuration.</div>;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="bg-white p-6 rounded-2xl border border-stone-100 shadow-sm">
                <h3 className="text-sm font-bold uppercase tracking-widest text-brand-dark mb-6 flex items-center gap-2">
                    <Database size={18} /> Storage Configuration
                </h3>
                
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-stone-50 p-4 rounded-xl border border-stone-100">
                            <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Persistent Data Root</p>
                            <p className="font-mono text-xs text-brand-dark break-all">{storageConfig.dataRoot}</p>
                            <p className="text-[10px] text-stone-500 mt-2">The absolute path where backups, sqlite databases (if applicable), and root files are stored on this server.</p>
                        </div>
                        <div className="bg-stone-50 p-4 rounded-xl border border-stone-100">
                            <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Active Uploads Directory</p>
                            <p className="font-mono text-xs text-brand-dark break-all">{storageConfig.uploadsRoot}</p>
                            <p className="text-[10px] text-stone-500 mt-2">The absolute path where all product images and media files are stored across sizes.</p>
                        </div>
                    </div>

                    <div className="border-t border-stone-100 pt-6">
                        <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-4">Storage Formats & Engine</p>
                        <div className="flex flex-wrap gap-2">
                            {storageConfig.engineFolders.map((f: string) => (
                                <span key={f} className="px-3 py-1 bg-white border border-stone-200 rounded-full text-[10px] font-bold uppercase tracking-widest text-stone-500">Size: {f}w</span>
                            ))}
                            {storageConfig.imageFormats.map((f: string) => (
                                <span key={f} className="px-3 py-1 bg-brand-gold/10 border border-brand-gold/20 rounded-full text-[10px] font-bold uppercase tracking-widest text-brand-gold">{f}</span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
