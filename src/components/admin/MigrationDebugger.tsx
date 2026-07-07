import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/services/storeService';
import { Terminal, RefreshCw, AlertCircle } from 'lucide-react';

export const MigrationDebugger: React.FC = () => {
    const [logs, setLogs] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const fetchLogs = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await apiFetch('/api/admin/migration-log');
            setLogs(res.logs || []);
        } catch (e: any) {
            setError(e.message || 'Failed to fetch logs');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 2000); // Poll every 2 seconds
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="bg-[#1e1e1e] rounded-2xl border border-stone-800 shadow-xl overflow-hidden mt-6">
            <div className="bg-stone-900 px-4 py-3 flex items-center justify-between border-b border-stone-800">
                <div className="flex items-center gap-2 text-stone-400">
                    <Terminal size={14} />
                    <span className="text-[10px] font-mono uppercase tracking-widest font-bold">Migration Terminal</span>
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
            
            <div className="p-4 font-mono text-[10px] sm:text-xs leading-relaxed h-[240px] overflow-y-auto text-stone-300">
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
    );
};
