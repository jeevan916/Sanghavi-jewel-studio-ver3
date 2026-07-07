import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/services/storeService';
import { Terminal, RefreshCw, AlertCircle, Play, CheckCircle2 } from 'lucide-react';

export const MigrationDebugger: React.FC = () => {
    const [logs, setLogs] = useState<string[]>([]);
    const [pendingProducts, setPendingProducts] = useState<string[]>([]);
    const [pendingCount, setPendingCount] = useState<number>(0);
    const [loading, setLoading] = useState(false);
    const [migratingId, setMigratingId] = useState<string | null>(null);
    const [error, setError] = useState('');

    const fetchStatus = async () => {
        try {
            const res = await apiFetch('/api/admin/migration-status');
            setPendingProducts(res.pendingProducts || []);
            setPendingCount(res.pendingCount || 0);
        } catch (e: any) {
            console.error("Status fetch error", e);
        }
    };

    const fetchLogs = async () => {
        try {
            const res = await apiFetch('/api/admin/migration-log');
            setLogs(res.logs || []);
        } catch (e: any) {
            setError(e.message || 'Failed to fetch logs');
        }
    };

    const refreshAll = async () => {
        setLoading(true);
        await Promise.all([fetchStatus(), fetchLogs()]);
        setLoading(false);
    };

    useEffect(() => {
        refreshAll();
        const interval = setInterval(() => {
            fetchLogs();
            fetchStatus();
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    const migrateOne = async (id: string) => {
        setMigratingId(id);
        try {
            await apiFetch('/api/admin/migrate-blobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId: id })
            });
            // Give it a second to process then refresh status
            setTimeout(fetchStatus, 2000);
        } catch (e: any) {
            alert('Failed to start migration: ' + e.message);
        } finally {
            setMigratingId(null);
        }
    };

    const migrateAll = async () => {
        if (!confirm('Are you sure you want to migrate all pending products at once?')) return;
        setMigratingId('all');
        try {
            await apiFetch('/api/admin/migrate-blobs', { method: 'POST' });
        } catch (e: any) {
            alert('Failed to start bulk migration: ' + e.message);
        } finally {
            setMigratingId(null);
        }
    };

    return (
        <div className="space-y-4 mt-6">
            <div className="bg-white p-4 rounded-xl border border-stone-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-brand-dark mb-1">Migration Status</h4>
                    <p className="text-[10px] text-stone-500">
                        {pendingCount === 0 ? 'All products are migrated to disk.' : `${pendingCount} products still have base64 blobs in database.`}
                    </p>
                </div>
                
                {pendingCount > 0 && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={migrateAll}
                            disabled={migratingId !== null}
                            className="px-4 py-2 bg-brand-dark text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-gold transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            {migratingId === 'all' ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
                            Migrate All Remaining
                        </button>
                    </div>
                )}
            </div>

            {pendingCount > 0 && (
                <div className="bg-white p-4 rounded-xl border border-stone-100">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-3">Pending Products (Next {pendingProducts.length})</h4>
                    <div className="flex flex-wrap gap-2">
                        {pendingProducts.map(id => (
                            <div key={id} className="flex items-center gap-2 bg-stone-50 border border-stone-100 px-3 py-1.5 rounded-lg">
                                <span className="font-mono text-[10px] text-brand-dark">{id}</span>
                                <button
                                    onClick={() => migrateOne(id)}
                                    disabled={migratingId !== null}
                                    className="p-1 hover:bg-brand-gold/10 hover:text-brand-gold rounded text-stone-400 transition-colors disabled:opacity-50"
                                    title="Migrate this product"
                                >
                                    {migratingId === id ? <RefreshCw size={12} className="animate-spin text-brand-gold" /> : <Play size={12} />}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="bg-[#1e1e1e] rounded-2xl border border-stone-800 shadow-xl overflow-hidden">
                <div className="bg-stone-900 px-4 py-3 flex items-center justify-between border-b border-stone-800">
                    <div className="flex items-center gap-2 text-stone-400">
                        <Terminal size={14} />
                        <span className="text-[10px] font-mono uppercase tracking-widest font-bold">Server Logs</span>
                    </div>
                    <div className="flex items-center gap-3">
                        {loading && <RefreshCw size={12} className="animate-spin text-brand-gold" />}
                        <div className="flex gap-1.5 items-center">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-red-500"></div></div>
                            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20 flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-yellow-500"></div></div>
                            <div className="w-2.5 h-2.5 rounded-full bg-green-500/20 flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-green-500"></div></div>
                        </div>
                    </div>
                </div>
                
                <div className="p-4 font-mono text-[10px] sm:text-[11px] leading-relaxed h-[240px] overflow-y-auto text-stone-300">
                    {error ? (
                        <div className="flex items-center gap-2 text-red-400 p-2 bg-red-400/10 rounded-lg">
                            <AlertCircle size={14} />
                            <span>{error}</span>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="text-stone-500 italic">No migration logs found...</div>
                    ) : (
                        <div className="space-y-1">
                            {logs.map((log, i) => {
                                const isError = log.toLowerCase().includes('error') || log.toLowerCase().includes('failed');
                                const isSuccess = log.toLowerCase().includes('completed') || log.toLowerCase().includes('successfully');
                                
                                return (
                                    <div key={i} className={`break-all ${isError ? 'text-red-400' : isSuccess ? 'text-green-400' : ''}`}>
                                        {log}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
