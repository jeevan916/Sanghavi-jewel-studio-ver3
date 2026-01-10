
import React, { useState, useEffect } from 'react';
import { storeService } from '../services/storeService';
import { enhanceJewelryImage } from '../services/geminiService';
import { useUpload } from '../contexts/UploadContext';
import { Product } from '../types';
import { 
  Zap, RefreshCw, Loader2, CheckCircle, AlertTriangle, 
  Image as ImageIcon, ShieldCheck, Sparkles, Wand2, ArrowLeft,
  Database, Download, Trash2, Archive, Shield, History, Cpu
} from 'lucide-react';

interface MaintenanceProps {
  onBack: () => void;
}

export const Maintenance: React.FC<MaintenanceProps> = ({ onBack }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, success: 0, error: 0 });
  const [log, setLog] = useState<string[]>([]);
  const { processImage } = useUpload();
  
  const [backups, setBackups] = useState<any[]>([]);
  const [isBackupLoading, setIsBackupLoading] = useState(false);

  useEffect(() => {
    storeService.getProducts(1, 2000, { publicOnly: false }).then(res => setProducts(res.items));
    loadBackups();
  }, []);

  const loadBackups = async () => {
    try {
      const data = await storeService.getBackups();
      setBackups(data);
    } catch (e) {}
  };

  const handleCreateBackup = async () => {
    setIsBackupLoading(true);
    addLog('Starting full vault backup (Next-Gen ZIP)...');
    try {
      const res = await storeService.createBackup();
      addLog(`Backup complete: ${res.filename} (${(res.size/1024/1024).toFixed(2)} MB)`);
      loadBackups();
    } catch (e: any) {
      addLog(`Backup error: ${e.message}`);
    } finally {
      setIsBackupLoading(false);
    }
  };

  const handleDeleteBackup = async (name: string) => {
    if(!window.confirm("Delete this backup permanently from server?")) return;
    try {
      await storeService.deleteBackup(name);
      loadBackups();
    } catch (e) {}
  };

  const addLog = (msg: string) => setLog(prev => [msg, ...prev].slice(0, 50));

  const runReOptimization = async () => {
    if (!window.confirm(`Re-optimize all ${products.length} products to Next-Gen AVIF/WebP formats?`)) return;
    setIsProcessing(true);
    setProgress({ current: 0, total: products.length, success: 0, error: 0 });
    addLog("Initializing AVIF/WebP Transcoding Engine...");

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      try {
        const sourceImg = p.images[0];
        // High-res: AVIF (Ultra compression)
        const newHighRes = await processImage(sourceImg, 2200, 0.85, 'image/avif');
        // Thumbnail: WebP (High speed)
        const newThumb = await processImage(sourceImg, 400, 0.6, 'image/webp');
        
        await storeService.updateProduct({ ...p, images: [newHighRes], thumbnails: [newThumb] });
        setProgress(prev => ({ ...prev, current: i + 1, success: prev.success + 1 }));
      } catch (err) {
        setProgress(prev => ({ ...prev, current: i + 1, error: prev.error + 1 }));
        addLog(`Error on ${p.title}`);
      }
    }
    setIsProcessing(false);
    addLog("Batch Re-Optimization Complete.");
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 pb-24 animate-fade-in text-stone-800">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="p-2 hover:bg-stone-100 rounded-full transition-colors"><ArrowLeft size={24}/></button>
        <div>
          <h2 className="font-serif text-3xl text-gold-700">Vault Maintenance</h2>
          <p className="text-stone-500 text-sm">Global image re-processing and data protection tools.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center"><Cpu size={20} /></div>
          <h3 className="font-bold">Next-Gen Engine</h3>
          <p className="text-xs text-stone-500">Transcode entire catalog to AVIF (Storage) and WebP (Speed).</p>
          <button disabled={isProcessing} onClick={runReOptimization} className="w-full py-2 bg-stone-900 text-white rounded-lg text-xs font-bold disabled:opacity-50">Transcode All</button>
        </div>

        <div className="bg-stone-900 p-6 rounded-2xl shadow-xl space-y-4 text-white">
          <div className="w-10 h-10 bg-gold-500 text-white rounded-xl flex items-center justify-center"><Archive size={20} /></div>
          <h3 className="font-serif">Backup Vault</h3>
          <p className="text-xs text-stone-400">Create a compressed ZIP of the entire database and physical image storage.</p>
          <button disabled={isBackupLoading} onClick={handleCreateBackup} className="w-full py-2 bg-gold-600 text-white rounded-lg text-xs font-bold disabled:opacity-50">
            {isBackupLoading ? 'Backing up...' : 'Create Snapshot'}
          </button>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
          <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center"><Shield size={20} /></div>
          <h3 className="font-bold">Security</h3>
          <p className="text-xs text-stone-500">Audit logs and persistence integrity checks.</p>
          <button className="w-full py-2 bg-stone-100 text-stone-600 rounded-lg text-xs font-bold">Audit Health</button>
        </div>
      </div>

      {isProcessing && (
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm mb-6">
           <div className="flex justify-between items-center mb-2">
             <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Transcoding: {progress.current} / {progress.total}</span>
             <span className="text-[10px] font-bold text-gold-600">{Math.round((progress.current/progress.total)*100)}%</span>
           </div>
           <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
             <div className="bg-gold-500 h-full transition-all duration-300" style={{width: `${(progress.current/progress.total)*100}%`}}></div>
           </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden mb-8">
        <div className="bg-stone-50 px-6 py-4 border-b border-stone-200 flex justify-between items-center">
          <h4 className="font-bold text-sm flex items-center gap-2"><History size={16}/> Snapshot History</h4>
          <span className="text-[10px] uppercase font-bold text-stone-400 tracking-widest">{backups.length} Backups stored</span>
        </div>
        <div className="divide-y divide-stone-100">
          {backups.map((b, idx) => (
            <div key={idx} className="px-6 py-4 flex items-center justify-between hover:bg-stone-50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-stone-100 rounded-lg flex items-center justify-center text-stone-400"><Database size={20}/></div>
                <div>
                  <p className="text-sm font-bold text-stone-800">{b.name}</p>
                  <p className="text-[10px] text-stone-500 uppercase tracking-widest">{new Date(b.date).toLocaleString()} • {(b.size/1024/1024).toFixed(2)} MB</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a href={storeService.downloadBackupUrl(b.name)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Download ZIP"><Download size={18}/></a>
                <button onClick={() => handleDeleteBackup(b.name)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors" title="Delete Backup"><Trash2 size={18}/></button>
              </div>
            </div>
          ))}
          {backups.length === 0 && <div className="p-8 text-center text-stone-400 italic text-sm">No backup snapshots found in .builds/backup</div>}
        </div>
      </div>

      <div className="bg-stone-50 border border-stone-200 rounded-2xl overflow-hidden">
        <div className="bg-stone-100 px-4 py-2 border-b border-stone-200 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Maintenance Logs</div>
        <div className="p-4 h-32 overflow-y-auto font-mono text-[10px] space-y-1">
          {log.map((entry, idx) => (
            <div key={idx} className="text-stone-600 border-l-2 border-stone-300 pl-2">{entry}</div>
          ))}
          {log.length === 0 && <span className="text-stone-300 italic">Logs will appear here during active tasks.</span>}
        </div>
      </div>
    </div>
  );
};
