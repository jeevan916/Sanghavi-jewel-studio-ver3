import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { storeService } from '../services/storeService';
import { coreEngine } from '../services/coreEngine';
import { Product, AnalyticsEvent, User } from '../types';
import { 
  Loader2, Settings, Folder, Trash2, Edit2, Plus, Search, 
  Grid, List as ListIcon, Lock, CheckCircle, X, 
  LayoutDashboard, FolderOpen, UserCheck, HardDrive, Database, RefreshCw, TrendingUp, BrainCircuit, MapPin, DollarSign, Smartphone, MessageCircle, Save, AlertTriangle, Cpu, Activity, ShieldCheck
} from 'lucide-react';

interface AdminDashboardProps {
  onNavigate?: (tab: string) => void;
}

type ViewMode = 'overview' | 'files' | 'leads' | 'trends' | 'intelligence' | 'neural';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<ViewMode>('overview');
  const [products, setProducts] = useState<Product[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsEvent[]>([]);
  const [customers, setCustomers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [healthInfo, setHealthInfo] = useState<{mode?: string, healthy: boolean}>({healthy: false});
  const [intelligence, setIntelligence] = useState<any>(null);

  const [selectedFolder, setSelectedFolder] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewStyle, setViewStyle] = useState<'grid' | 'list'>('grid');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  // Core Engine Data
  const memory = coreEngine.getMemory();
  const fixHistory = coreEngine.getFixHistory();

  const refreshData = async (background = false) => {
    if (!background) setLoading(true);
    else setIsSyncing(true);
    try {
        const h = await storeService.checkServerHealth();
        setHealthInfo(h);
        
        if (h.healthy) {
            const [pRes, a, c, intel] = await Promise.all([
              storeService.getProducts(1, 1000, { publicOnly: false }), 
              storeService.getAnalytics(),
              storeService.getCustomers(),
              storeService.getBusinessIntelligence()
            ]);
            setProducts(Array.isArray(pRes?.items) ? pRes.items : []);
            setAnalytics(Array.isArray(a) ? a : []);
            setCustomers(Array.isArray(c) ? c : []);
            setIntelligence(intel);
        }
    } catch (e) {
        console.error("Dashboard Sync Failed", e);
    }
    setLoading(false);
    setIsSyncing(false);
  };

  useEffect(() => {
    refreshData();
    const interval = setInterval(() => refreshData(true), 30000);
    return () => clearInterval(interval);
  }, []);

  const folders = useMemo(() => {
      if (!Array.isArray(products)) return ['All', 'Private'];
      const cats = new Set(products.map(p => p?.category).filter(Boolean));
      return ['All', 'Private', ...Array.from(cats)];
  }, [products]);

  const filteredProducts = useMemo(() => {
      if (!Array.isArray(products)) return [];
      return products.filter(p => {
          if (!p) return false;
          const matchesFolder = 
            selectedFolder === 'All' ? true :
            selectedFolder === 'Private' ? p.isHidden :
            p.category === selectedFolder;
          const matchesSearch = p.title?.toLowerCase().includes(searchQuery.toLowerCase()) || p.id?.includes(searchQuery);
          return matchesFolder && matchesSearch;
      });
  }, [products, selectedFolder, searchQuery]);

  const recentInquiries = useMemo(() => {
    if (!Array.isArray(analytics)) return [];
    return analytics.filter(e => e?.type === 'inquiry').slice(0, 10);
  }, [analytics]);

  const trendingProducts = useMemo(() => {
      if (!Array.isArray(analytics) || !Array.isArray(products)) return [];
      const scores: Record<string, number> = {};
      analytics.forEach(e => {
          if (!e || !e.productId) return;
          if (!scores[e.productId]) scores[e.productId] = 0;
          
          if (e.type === 'inquiry') scores[e.productId] += 10;
          if (e.type === 'like') scores[e.productId] += 5;
          if (e.type === 'view') scores[e.productId] += 1;
          if (e.type === 'dislike') scores[e.productId] -= 3;
      });

      return Object.entries(scores)
          .sort(([,scoreA], [,scoreB]) => scoreB - scoreA)
          .slice(0, 10)
          .map(([id]) => {
              const product = products.find(p => p && p.id === id);
              return product ? { ...product, score: scores[id] } : null;
          })
          .filter(Boolean) as (Product & { score: number })[];
  }, [analytics, products]);

  if (loading && products.length === 0) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-stone-50">
        <Loader2 className="animate-spin text-gold-500 mb-4" size={32} />
        <p className="text-stone-400 text-xs uppercase tracking-widest">Connecting to Vault...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 md:pt-24 pb-24 min-h-screen flex flex-col">
      <header className="flex-none mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex justify-between items-start w-full md:w-auto">
           <div>
              <h2 className="font-serif text-3xl text-stone-900">Vault Administration</h2>
              <div className="flex items-center gap-2 mt-1">
                 <div className={`w-2 h-2 rounded-full ${healthInfo.healthy ? 'bg-teal-500' : 'bg-red-500 animate-pulse'}`} />
                 <p className="text-stone-500 text-[10px] uppercase font-bold tracking-widest flex items-center gap-2">
                    {healthInfo.healthy ? 'Live SQL Synchronized' : 'DB Disconnected - Retrying...'}
                    {isSyncing && <RefreshCw size={10} className="animate-spin text-gold-500" />}
                 </p>
              </div>
           </div>
        </div>
        
        <div className="flex bg-stone-100 p-1 rounded-xl items-center overflow-x-auto">
            {[
              { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
              { id: 'files', icon: FolderOpen, label: 'Assets' },
              { id: 'leads', icon: UserCheck, label: 'Leads' },
              { id: 'trends', icon: TrendingUp, label: 'Trends' },
              { id: 'neural', icon: BrainCircuit, label: 'Neural Core' },
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveView(tab.id as ViewMode)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeView === tab.id ? 'bg-white shadow text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}
              >
                  <tab.icon size={16} /> {tab.label}
              </button>
            ))}
        </div>
      </header>

      {activeView === 'overview' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex items-center gap-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><HardDrive size={24} /></div>
                    <div><p className="text-stone-500 text-[10px] font-bold uppercase tracking-widest">Inventory</p><p className="text-2xl font-bold text-stone-800">{products.length}</p></div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex items-center gap-4">
                    <div className="p-3 bg-green-50 text-green-600 rounded-xl"><UserCheck size={24} /></div>
                    <div><p className="text-stone-500 text-[10px] font-bold uppercase tracking-widest">Leads</p><p className="text-2xl font-bold text-stone-800">{customers.length}</p></div>
                </div>
          </div>
      )}

      {activeView === 'neural' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
              <div className="bg-stone-900 text-white p-8 rounded-3xl shadow-xl border border-stone-800">
                  <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 bg-gold-500/10 rounded-xl border border-gold-500/20">
                          <BrainCircuit size={24} className="text-gold-500" />
                      </div>
                      <div>
                          <h3 className="font-serif text-2xl text-gold-500">Core Engine v{memory.version}</h3>
                          <p className="text-stone-400 text-xs uppercase tracking-widest">{memory.identity}</p>
                      </div>
                  </div>
                  
                  <div className="space-y-6">
                      <div>
                          <h4 className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-3 flex items-center gap-2"><Lock size={12}/> Locked Features (Immutable)</h4>
                          <div className="grid grid-cols-1 gap-2">
                              {memory.locked_features.map(f => (
                                  <div key={f.id} className="p-3 bg-stone-800/50 rounded-xl border border-stone-700/50 flex justify-between items-center">
                                      <div className="flex items-center gap-3">
                                          <div className={`w-2 h-2 rounded-full ${f.status === 'stable' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                                          <span className="font-medium text-sm text-stone-200">{f.name}</span>
                                      </div>
                                      <ShieldCheck size={16} className="text-gold-500/50" />
                                  </div>
                              ))}
                          </div>
                      </div>

                      <div>
                          <h4 className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-3 flex items-center gap-2"><Cpu size={12}/> Architecture Rules</h4>
                          <div className="space-y-2">
                              {memory.architecture_rules.map((rule, i) => (
                                  <div key={i} className="text-xs font-mono text-stone-400 bg-black/20 p-2 rounded border-l-2 border-gold-500/50">
                                      {rule}
                                  </div>
                              ))}
                          </div>
                      </div>
                  </div>
              </div>

              <div className="space-y-6">
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200">
                      <h4 className="font-serif text-xl text-stone-800 mb-4 flex items-center gap-2">
                          <Activity size={20} className="text-blue-500" /> Recent Fix Memory
                      </h4>
                      <div className="space-y-3">
                          {fixHistory.map((fix, i) => (
                              <div key={i} className="flex gap-3 items-start">
                                  <CheckCircle size={16} className="text-green-500 mt-0.5 shrink-0" />
                                  <p className="text-sm text-stone-600">{fix}</p>
                              </div>
                          ))}
                      </div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-3xl border border-blue-100">
                      <h4 className="font-serif text-xl text-blue-900 mb-2">Engine Status</h4>
                      <div className="flex items-center gap-2 mb-4">
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-[10px] font-bold uppercase">Active</span>
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-[10px] font-bold uppercase">Monitoring</span>
                      </div>
                      <p className="text-sm text-blue-800/80 leading-relaxed">
                          The Core Engine is actively monitoring the codebase for regression. 
                          Critical features like the AI Slider and Server-Side Sharp processing are locked and protected.
                      </p>
                  </div>
              </div>
          </div>
      )}

      {activeView === 'files' && (
          <div className="flex-1 flex flex-col md:flex-row bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden min-h-[500px]">
             <div className="w-full md:w-64 bg-stone-50 border-r border-stone-200 flex flex-col p-4">
                 <button onClick={() => onNavigate?.('upload')} className="w-full py-2.5 bg-stone-900 text-white rounded-xl flex items-center justify-center gap-2 mb-4 text-xs font-bold uppercase tracking-widest"><Plus size={18} /> Add Stock</button>
                 <div className="space-y-1">
                     {folders.map(folder => (
                         <button key={folder} onClick={() => setSelectedFolder(folder)} className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-3 ${selectedFolder === folder ? 'bg-white shadow-sm text-gold-700 font-bold' : 'text-stone-500'}`}>
                             <Folder size={16} />{folder}
                         </button>
                     ))}
                 </div>
             </div>
             <div className="flex-1 p-4 overflow-y-auto">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredProducts.map(product => (
                        <div key={product.id} className="relative aspect-square bg-stone-100 rounded-xl overflow-hidden border border-stone-200 group">
                            <img src={product.thumbnails?.[0] || product.images?.[0]} className="w-full h-full object-cover" />
                            <div className="absolute inset-x-0 bottom-0 p-2 bg-black/60 text-white text-[10px] truncate">{product.title}</div>
                        </div>
                    ))}
                </div>
             </div>
          </div>
      )}
    </div>
  );
};

export default AdminDashboard;