import React, { useState, useEffect } from 'react';
import { Download, Trash2, RefreshCw, HardDrive, AlertTriangle } from 'lucide-react';
import { apiFetch } from '@/services/storeService.ts';

export const SystemBackupsPanel: React.FC = () => {
    const [backups, setBackups] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    const fetchBackups = async () => {
        setLoading(true);
        try {
            const res = await apiFetch('/api/admin/backups');
            setBackups(res.backups || []);
        } catch (e: any) {
            showFeedback('error', e.message || 'Failed to fetch backups');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBackups();
    }, []);

    const showFeedback = (type: 'success' | 'error', message: string) => {
        setFeedback({ type, message });
        setTimeout(() => setFeedback(null), 5000);
    };

    const handleTriggerBackup = async () => {
        setActionLoading(true);
        try {
            const res = await apiFetch('/api/admin/backups/trigger', { method: 'POST' });
            showFeedback('success', res.message || 'Backup started in background.');
            // Don't auto-fetch as it won't be ready immediately
        } catch (e: any) {
            showFeedback('error', e.message || 'Failed to trigger backup');
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async (filename: string) => {
        if (!confirm(`Are you sure you want to delete ${filename}?`)) return;
        
        setActionLoading(true);
        try {
            await apiFetch(`/api/admin/backups/${filename}`, { method: 'DELETE' });
            showFeedback('success', 'Backup deleted successfully');
            fetchBackups();
        } catch (e: any) {
            showFeedback('error', e.message || 'Failed to delete backup');
        } finally {
            setActionLoading(false);
        }
    };

    const handleDownload = (filename: string) => {
        const token = localStorage.getItem('staff_token');
        if (!token) return;
        
        // Use a direct download link with token in query params
        window.open(`/api/admin/backups/download/${filename}?token=${token}`, '_blank');
    };

    return (
        <div className="bg-white p-6 rounded-2xl border border-stone-100 shadow-sm mt-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-bold uppercase tracking-widest text-brand-dark flex items-center gap-2">
                    <HardDrive size={18} /> System Backups
                </h3>
                <button
                    onClick={handleTriggerBackup}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-brand-dark text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-gold transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                    {actionLoading ? <RefreshCw size={14} className="animate-spin" /> : <HardDrive size={14} />}
                    Create Manual Backup
                </button>
            </div>

            <div className="mb-4">
                <p className="text-[10px] text-stone-500 uppercase tracking-widest">
                    <AlertTriangle size={12} className="inline mr-1 text-brand-gold" />
                    Backups include a complete database dump and all uploaded images.
                    Automatic backups run daily at 02:00 AM (keeps last 7).
                </p>
            </div>

            {feedback && (
                <div className={`p-4 rounded-xl mb-6 text-xs font-bold uppercase tracking-widest ${feedback.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                    {feedback.message}
                </div>
            )}

            {loading ? (
                <div className="p-8 text-center text-stone-500 animate-pulse">Loading Backups...</div>
            ) : backups.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-stone-100 rounded-xl">
                    <p className="text-stone-400 text-xs font-medium uppercase tracking-widest">No backups found</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-stone-100">
                                <th className="pb-3 text-[10px] font-bold text-stone-400 uppercase tracking-widest">File Name</th>
                                <th className="pb-3 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Size</th>
                                <th className="pb-3 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Date Created</th>
                                <th className="pb-3 text-[10px] font-bold text-stone-400 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-50">
                            {backups.map(b => (
                                <tr key={b.filename} className="hover:bg-stone-50 transition-colors">
                                    <td className="py-4 text-xs font-mono text-brand-dark">
                                        <div className="flex items-center gap-2">
                                            {b.filename.includes('_auto_') ? (
                                                <span className="w-2 h-2 rounded-full bg-brand-gold" title="Auto Backup"></span>
                                            ) : (
                                                <span className="w-2 h-2 rounded-full bg-emerald-500" title="Manual Backup"></span>
                                            )}
                                            {b.filename}
                                        </div>
                                    </td>
                                    <td className="py-4 text-xs text-stone-500 font-medium">
                                        {(b.size / (1024 * 1024)).toFixed(2)} MB
                                    </td>
                                    <td className="py-4 text-xs text-stone-500 font-medium">
                                        {new Date(b.createdAt).toLocaleString()}
                                    </td>
                                    <td className="py-4 flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => handleDownload(b.filename)}
                                            className="p-2 text-stone-400 hover:text-brand-dark hover:bg-stone-200 rounded-lg transition-colors"
                                            title="Download Backup"
                                        >
                                            <Download size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(b.filename)}
                                            disabled={actionLoading}
                                            className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                            title="Delete Backup"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};
