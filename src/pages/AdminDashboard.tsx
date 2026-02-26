
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { storeService } from '@/services/storeService.ts';
import { coreEngine } from '@/services/coreEngine.ts';
import { Product, AnalyticsEvent, User, AppConfig } from '@/types.ts';
import { 
  Loader2, Settings, Folder, Trash2, Edit2, Plus, Search, 
  Grid, List as ListIcon, Lock, CheckCircle, X, Tag,
  LayoutDashboard, FolderOpen, UserCheck, HardDrive, Database, RefreshCw, TrendingUp, BrainCircuit, MapPin, DollarSign, Smartphone, MessageCircle, Save, AlertTriangle, Cpu, Activity, ShieldCheck, Zap, FolderInput, Heart, Eye, ArrowRight, Clock
} from 'lucide-react';

interface AdminDashboardProps {
  onNavigate?: (tab: string) => void;
}

type ViewMode = 'overview' | 'files' | 'leads' | 'activity' | 'trends' | 'neural' | 'market';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<ViewMode>('overview');
  const [products, setProducts] = useState<Product[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsEvent[]>([]);
  const [customers, setCustomers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [healthInfo, setHealthInfo] = useState<{mode?: string, healthy: boolean}>({healthy: false});
  const [config, setConfig] = useState<AppConfig | null>(null);

  const [selectedFolder, setSelectedFolder] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Asset Management State
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set<string>());
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [moveCategory, setMoveCategory] = useState('');
  const [moveSubCategory, setMoveSubCategory] = useState('');

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
            const [pRes, a, c, conf] = await Promise.all([
              storeService.getProducts(1, 1000, { publicOnly: false }), 
              storeService.getAnalytics(),
              storeService.getCustomers(),
              storeService.getConfig()
            ]);
            setProducts(Array.isArray(pRes?.items) ? pRes.items : []);
            setAnalytics(Array.isArray(a) ? a : []);
            setCustomers(Array.isArray(c) ? c : []);
            setConfig(conf);
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

  // Force refresh when switching critical tabs to ensure data is fresh
  useEffect(() => {
      if (activeView === 'leads' || activeView === 'trends' || activeView === 'activity') {
          refreshData(true);
      }
  }, [activeView]);

  const folders = useMemo(() => {
      if (!Array.isArray(products)) return ['All', 'Private'];
      const cats = new Set(products.map(p => p?.category).filter((c): c is string => typeof c === 'string' && !!c));
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
          const matchesSearch = (p.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || (p.id || '').includes(searchQuery);
          return matchesFolder && matchesSearch;
      });
  }, [products, selectedFolder, searchQuery]);

  const allAssets = useMemo(() => {
      return filteredProducts.flatMap(product => {
          const images = product.images || [];
          if (images.length === 0) return [{ ...product, displayImage: null as string | null, imageIndex: 0, assetId: `${product.id}-0` }];
          return images.map((img, idx) => ({
              ...product,
              displayImage: img as string | null,
              imageIndex: idx,
              assetId: `${product.id}-${idx}`
          }));
      });
  }, [filteredProducts]);

  // --- TRENDS ALGORITHM ---
  const trendingProducts = useMemo(() => {
      if (!analytics || analytics.length === 0) return [];
      
      const scores: Record<string, { id: string, title: string, score: number }> = {};
      
      analytics.forEach(event => {
          if (!event.productId) return;
          
          if (!scores[event.productId]) {
              scores[event.productId] = { 
                  id: event.productId, 
                  title: event.productTitle || 'Unknown Asset', 
                  score: 0 
              };
          }

          // Weighted Scoring Algorithm
          // Inquiry = 5 points
          // Like = 3 points
          // View = 1 point
          let weight = 1;
          if (event.type === 'inquiry') weight = 5;
          else if (event.type === 'like') weight = 3;
          
          scores[event.productId].score += weight;
      });

      return Object.values(scores)
          .sort((a, b) => b.score - a.score)
          .slice(0, 10); // Top 10
  }, [analytics]);

  // --- Asset Management Handlers ---
  const toggleAssetSelection = (id: string) => {
      const newSet = new Set(selectedAssets);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedAssets(newSet);
  };
  
  const handleBulkDelete = async () => {
      if (!confirm(`Permanently delete ${selectedAssets.size} assets? This cannot be undone.`)) return;
      setLoading(true);
      try {
          await Promise.all(Array.from(selectedAssets).map((id) => storeService.deleteProduct(id as string)));
          setSelectedAssets(new Set<string>());
          refreshData(true);
      } catch(e: any) { console.error(e); alert('Delete failed'); }
      setLoading(false);
  };

  const handleBulkMove = async () => {
      if (!moveCategory) return;
      setLoading(true);
      try {
          const updates = products.filter(p => selectedAssets.has(p.id));
          await Promise.all(updates.map(p => storeService.updateProduct({
              ...p,
              category: moveCategory,
              subCategory: moveSubCategory
          })));
          setIsMoveModalOpen(false);
          setSelectedAssets(new Set<string>());
          refreshData(true);
      } catch(e: any) { console.error(e); alert('Move failed'); }
      setLoading(false);
  };

  const activeSubCategories = config?.categories?.find(c => c.name === moveCategory)?.subCategories || [];

  if (loading && products.length === 0) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-white">
        <Loader2 className="animate-spin text-brand-gold mb-4" size={32} />
        <p className="text-stone-400 text-xs uppercase tracking-widest">Connecting to Vault...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 md:pt-24 pb-20 min-h-screen flex flex-col">
      <header className="flex-none mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex justify-between items-start w-full md:w-auto">
           <div>
              <h2 className="font-serif font-bold text-3xl text-brand-dark tracking-tight">Vault Administration</h2>
              <div className="flex items-center gap-2 mt-1">
                 <div className={`w-2 h-2 rounded-full ${healthInfo.healthy ? 'bg-emerald-500' : 'bg-brand-red animate-pulse'}`} />
                 <p className="text-stone-400 text-[10px] uppercase font-bold tracking-[0.3em] flex items-center gap-3">
                    {healthInfo.healthy ? 'Live SQL Synchronized' : 'DB Disconnected - Retrying...'}
                    {isSyncing && <RefreshCw size={12} className="animate-spin text-brand-gold" />}
                 </p>
              </div>
           </div>
        </div>
        
        <div className="flex bg-stone-100/50 p-1.5 rounded-2xl items-center overflow-x-auto border border-stone-100 backdrop-blur-sm">
            {[
              { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
              { id: 'files', icon: FolderOpen, label: 'Assets' },
              { id: 'leads', icon: UserCheck, label: 'Leads' },
              { id: 'activity', icon: Activity, label: 'Activity' },
              { id: 'trends', icon: TrendingUp, label: 'Trends' },
              { id: 'market', icon: DollarSign, label: 'Market' },
              { id: 'neural', icon: BrainCircuit, label: 'Neural' },
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveView(tab.id as ViewMode)}
                className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-[10px] font-bold transition-all whitespace-nowrap uppercase tracking-[0.2em] ${activeView === tab.id ? 'bg-white shadow-lg shadow-stone-200/50 text-brand-dark' : 'text-stone-400 hover:text-brand-dark'}`}
              >
                  <tab.icon size={14} /> {tab.label}
              </button>
            ))}
        </div>
      </header>

      {activeView === 'overview' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 animate-fade-in">
                <div 
                    onClick={() => setActiveView('files')}
                    className="bg-white p-8 rounded-[2rem] shadow-sm border border-stone-100 flex flex-col gap-6 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all group"
                >
                    <div className="w-14 h-14 bg-brand-gold/5 text-brand-gold rounded-2xl flex items-center justify-center group-hover:bg-brand-gold group-hover:text-white transition-all duration-500"><HardDrive size={28} /></div>
                    <div>
                        <p className="text-stone-400 text-[10px] font-bold uppercase tracking-[0.3em] mb-1">Inventory</p>
                        <p className="text-4xl font-serif font-bold text-brand-dark">{products.length}</p>
                    </div>
                </div>
                <div 
                    onClick={() => setActiveView('leads')}
                    className="bg-white p-8 rounded-[2rem] shadow-sm border border-stone-100 flex flex-col gap-6 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all group"
                >
                    <div className="w-14 h-14 bg-brand-red/5 text-brand-red rounded-2xl flex items-center justify-center group-hover:bg-brand-red group-hover:text-white transition-all duration-500"><UserCheck size={28} /></div>
                    <div>
                        <p className="text-stone-400 text-[10px] font-bold uppercase tracking-[0.3em] mb-1">Leads</p>
                        <p className="text-4xl font-serif font-bold text-brand-dark">{customers.length}</p>
                    </div>
                </div>
                <div 
                    onClick={() => setActiveView('activity')}
                    className="bg-white p-8 rounded-[2rem] shadow-sm border border-stone-100 flex flex-col gap-6 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all group"
                >
                    <div className="w-14 h-14 bg-brand-dark/5 text-brand-dark rounded-2xl flex items-center justify-center group-hover:bg-brand-dark group-hover:text-white transition-all duration-500"><Activity size={28} /></div>
                    <div>
                        <p className="text-stone-400 text-[10px] font-bold uppercase tracking-[0.3em] mb-1">Activity</p>
                        <p className="text-4xl font-serif font-bold text-brand-dark">{analytics.length}</p>
                    </div>
                </div>
                <div 
                    onClick={() => setActiveView('trends')}
                    className="bg-white p-8 rounded-[2rem] shadow-sm border border-stone-100 flex flex-col gap-6 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all group"
                >
                    <div className="w-14 h-14 bg-brand-gold/10 text-brand-gold rounded-2xl flex items-center justify-center group-hover:bg-brand-gold group-hover:text-white transition-all duration-500"><TrendingUp size={28} /></div>
                    <div>
                        <p className="text-stone-400 text-[10px] font-bold uppercase tracking-[0.3em] mb-1">Insights</p>
                        <p className="text-4xl font-serif font-bold text-brand-dark">Top 10</p>
                    </div>
                </div>
          </div>
      )}

      {activeView === 'market' && config && (
          <div className="flex-1 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-100 space-y-6">
                      <div className="flex items-center gap-3 text-brand-gold">
                          <DollarSign size={20} />
                          <h3 className="font-bold uppercase tracking-widest text-xs">Gold Rate (22K)</h3>
                      </div>
                      <div className="space-y-2">
                          <input 
                              type="number" 
                              value={config.goldRate22k} 
                              onChange={e => setConfig({...config, goldRate22k: parseFloat(e.target.value)})}
                              className="text-4xl font-serif font-bold text-brand-dark bg-transparent w-full outline-none focus:text-brand-gold transition-colors"
                          />
                          <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Price per gram (₹)</p>
                      </div>
                  </div>

                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-100 space-y-6">
                      <div className="flex items-center gap-3 text-brand-gold">
                          <DollarSign size={20} />
                          <h3 className="font-bold uppercase tracking-widest text-xs">Gold Rate (24K)</h3>
                      </div>
                      <div className="space-y-2">
                          <input 
                              type="number" 
                              value={config.goldRate24k} 
                              onChange={e => setConfig({...config, goldRate24k: parseFloat(e.target.value)})}
                              className="text-4xl font-serif font-bold text-brand-dark bg-transparent w-full outline-none focus:text-brand-gold transition-colors"
                          />
                          <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Price per gram (₹)</p>
                      </div>
                  </div>

                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-100 space-y-6">
                      <div className="flex items-center gap-3 text-brand-gold">
                          <ShieldCheck size={20} />
                          <h3 className="font-bold uppercase tracking-widest text-xs">Tax (GST)</h3>
                      </div>
                      <div className="space-y-2">
                          <div className="flex items-baseline gap-2">
                            <input 
                                type="number" 
                                value={config.gstPercent} 
                                onChange={e => setConfig({...config, gstPercent: parseFloat(e.target.value)})}
                                className="text-4xl font-serif font-bold text-brand-dark bg-transparent w-24 outline-none focus:text-brand-gold transition-colors"
                            />
                            <span className="text-2xl font-serif font-bold text-stone-300">%</span>
                          </div>
                          <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Standard Jewelry GST</p>
                      </div>
                  </div>
              </div>

              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-stone-100 space-y-8">
                  <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-brand-gold">
                          <Tag size={20} />
                          <h3 className="font-bold uppercase tracking-widest text-xs">Making Charge Segments</h3>
                      </div>
                      <button 
                        onClick={() => {
                            const name = prompt("Segment Name (e.g. Classic)");
                            const percent = parseFloat(prompt("Percentage (e.g. 10)") || "0");
                            if (name && !isNaN(percent)) {
                                const newSegment = { id: name.toLowerCase().replace(/\s+/g, '-'), name, percent };
                                setConfig({...config, makingChargeSegments: [...config.makingChargeSegments, newSegment]});
                            }
                        }}
                        className="p-2 bg-stone-50 text-brand-gold rounded-xl hover:bg-brand-gold hover:text-white transition-all"
                      >
                          <Plus size={18} />
                      </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {config.makingChargeSegments.map(segment => (
                          <div key={segment.id} className={`p-6 rounded-2xl border transition-all relative group ${config.defaultMakingChargeSegmentId === segment.id ? 'border-brand-gold bg-brand-gold/5' : 'border-stone-100 bg-stone-50/50'}`}>
                              <div className="flex justify-between items-start mb-4">
                                  <div>
                                      <p className="font-bold text-brand-dark uppercase tracking-widest text-xs">{segment.name}</p>
                                      <p className="text-2xl font-serif font-bold text-brand-gold">{segment.percent}%</p>
                                  </div>
                                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button 
                                        onClick={() => {
                                            const newPercent = parseFloat(prompt("New Percentage", segment.percent.toString()) || segment.percent.toString());
                                            if (!isNaN(newPercent)) {
                                                setConfig({
                                                    ...config, 
                                                    makingChargeSegments: config.makingChargeSegments.map(s => s.id === segment.id ? {...s, percent: newPercent} : s)
                                                });
                                            }
                                        }}
                                        className="p-1.5 text-stone-400 hover:text-brand-dark"
                                      >
                                          <Edit2 size={14} />
                                      </button>
                                      <button 
                                        onClick={() => {
                                            if (config.makingChargeSegments.length <= 1) return alert("Must have at least one segment");
                                            setConfig({
                                                ...config, 
                                                makingChargeSegments: config.makingChargeSegments.filter(s => s.id !== segment.id),
                                                defaultMakingChargeSegmentId: config.defaultMakingChargeSegmentId === segment.id ? config.makingChargeSegments.find(s => s.id !== segment.id)?.id : config.defaultMakingChargeSegmentId
                                            });
                                        }}
                                        className="p-1.5 text-stone-400 hover:text-brand-red"
                                      >
                                          <Trash2 size={14} />
                                      </button>
                                  </div>
                              </div>
                              <button 
                                onClick={() => setConfig({...config, defaultMakingChargeSegmentId: segment.id})}
                                className={`w-full py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all ${config.defaultMakingChargeSegmentId === segment.id ? 'bg-brand-gold text-white' : 'bg-white text-stone-400 border border-stone-100 hover:border-brand-gold hover:text-brand-gold'}`}
                              >
                                  {config.defaultMakingChargeSegmentId === segment.id ? 'Default Segment' : 'Set as Default'}
                              </button>
                          </div>
                      ))}
                  </div>
              </div>

              <div className="bg-brand-dark text-white p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-96 h-96 bg-brand-gold/10 blur-[120px] -mr-48 -mt-48 rounded-full" />
                  <div className="relative flex flex-col md:flex-row items-center justify-between gap-8">
                      <div className="space-y-2 text-center md:text-left">
                          <h2 className="text-3xl font-serif font-bold">Update Market Rates</h2>
                          <p className="text-stone-400 text-sm max-w-md">Updating these rates will immediately reflect across the entire catalogue for all customers. Ensure accuracy before saving.</p>
                      </div>
                      <button 
                          onClick={async () => {
                              setIsSyncing(true);
                              try {
                                  await storeService.saveConfig(config);
                                  alert("Market rates updated successfully.");
                              } catch (e) { alert("Failed to update rates."); }
                              setIsSyncing(false);
                          }}
                          className="px-12 py-5 bg-brand-gold text-brand-dark rounded-2xl font-bold uppercase tracking-[0.2em] text-xs hover:bg-white transition-all shadow-xl active:scale-95 flex items-center gap-3"
                      >
                          <Save size={18} /> Publish Changes
                      </button>
                  </div>
              </div>

              <div className="bg-white p-8 rounded-3xl border border-stone-100">
                  <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.4em] mb-6">Pricing Logic Preview</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      <div className="space-y-4">
                          <p className="text-sm text-stone-600 leading-relaxed">
                              Our system uses a <span className="text-brand-dark font-bold">Dynamic Valuation Engine</span>. 
                              The final price is calculated as:
                          </p>
                          <div className="p-6 bg-stone-50 rounded-2xl font-mono text-xs space-y-2 text-stone-500 border border-stone-100">
                              <p>Base = Weight × Gold Rate</p>
                              <p>Making = Base × Making %</p>
                              <p>Subtotal = Base + Making + Other</p>
                              <p>Total = Subtotal + (Subtotal × GST %)</p>
                          </div>
                      </div>
                      <div className="flex items-center justify-center">
                          <div className="text-center space-y-2">
                              <div className="w-16 h-16 bg-brand-gold/10 text-brand-gold rounded-full flex items-center justify-center mx-auto mb-4">
                                  <TrendingUp size={32} />
                              </div>
                              <h4 className="font-bold text-brand-dark uppercase tracking-widest text-xs">Live Sync Enabled</h4>
                              <p className="text-[10px] text-stone-400 uppercase tracking-tighter">Connected to Sanghavi Cloud</p>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {activeView === 'neural' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
              <div className="bg-brand-dark text-white p-10 rounded-[2.5rem] shadow-2xl border border-white/5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-brand-gold/5 blur-[100px] -mr-32 -mt-32 rounded-full" />
                  
                  <div className="flex items-center gap-4 mb-10 relative">
                      <div className="p-4 bg-brand-gold/10 rounded-2xl border border-brand-gold/20">
                          <BrainCircuit size={32} className="text-brand-gold" />
                      </div>
                      <div>
                          <h3 className="font-serif font-bold text-3xl text-brand-gold tracking-tight">Core Engine v{memory.version}</h3>
                          <p className="text-stone-500 text-[10px] uppercase font-bold tracking-[0.3em] mt-1">{memory.identity}</p>
                      </div>
                  </div>
                  
                  <div className="space-y-10 relative">
                      {/* Active Abilities Section */}
                      <div>
                           <h4 className="text-[10px] font-bold text-stone-500 uppercase tracking-[0.3em] mb-5 flex items-center gap-3"><Zap size={14}/> Active Capabilities</h4>
                           <div className="grid grid-cols-2 gap-4">
                               <div className="p-5 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/[0.08] transition-colors">
                                   <p className="text-[9px] text-stone-500 uppercase font-bold tracking-widest mb-1">Analysis Model</p>
                                   <p className="text-xs font-mono text-brand-gold truncate">{config?.aiConfig?.models?.analysis || 'System Default'}</p>
                               </div>
                               <div className="p-5 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/[0.08] transition-colors">
                                   <p className="text-[9px] text-stone-500 uppercase font-bold tracking-widest mb-1">Design Model</p>
                                   <p className="text-xs font-mono text-brand-gold truncate">{config?.aiConfig?.models?.design || 'System Default'}</p>
                               </div>
                               <div className="p-5 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/[0.08] transition-colors">
                                   <p className="text-[9px] text-stone-500 uppercase font-bold tracking-widest mb-1">Analysis Templates</p>
                                   <p className="text-2xl font-serif font-bold text-white">{config?.aiConfig?.templates?.analysis?.length || 0}</p>
                               </div>
                               <div className="p-5 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/[0.08] transition-colors">
                                   <p className="text-[9px] text-stone-500 uppercase font-bold tracking-widest mb-1">Design Templates</p>
                                   <p className="text-2xl font-serif font-bold text-white">{config?.aiConfig?.templates?.design?.length || 0}</p>
                               </div>
                           </div>
                      </div>

                      <div>
                          <h4 className="text-[10px] font-bold text-stone-500 uppercase tracking-[0.3em] mb-5 flex items-center gap-3"><Lock size={14}/> Immutable Core Features</h4>
                          <div className="grid grid-cols-1 gap-3">
                              {memory.locked_features.map(f => (
                                  <div key={f.id} className="p-4 bg-white/5 rounded-2xl border border-white/5 flex justify-between items-center hover:bg-white/[0.08] transition-all">
                                      <div className="flex items-center gap-4">
                                          <div className={`w-2 h-2 rounded-full ${f.status === 'stable' ? 'bg-emerald-500' : 'bg-brand-gold'} shadow-[0_0_10px_rgba(16,185,129,0.3)]`} />
                                          <span className="font-bold text-xs text-stone-200 uppercase tracking-[0.2em]">{f.name}</span>
                                      </div>
                                      <ShieldCheck size={18} className="text-brand-gold/30" />
                                  </div>
                              ))}
                          </div>
                      </div>
                  </div>
              </div>

              <div className="space-y-8">
                  <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-stone-100">
                      <h4 className="font-serif font-bold text-2xl text-brand-dark tracking-tight mb-6 flex items-center gap-3">
                          <Activity size={24} className="text-brand-red" /> Neural Fix Memory
                      </h4>
                      <div className="space-y-4">
                          {fixHistory.map((fix, i) => (
                              <div key={i} className="flex gap-4 items-start p-4 rounded-2xl bg-stone-50/50 border border-stone-100 hover:bg-stone-50 transition-colors">
                                  <CheckCircle size={18} className="text-emerald-500 mt-0.5 shrink-0" />
                                  <p className="text-sm text-stone-600 font-medium leading-relaxed">{fix}</p>
                              </div>
                          ))}
                      </div>
                  </div>
                  
                  <div className="bg-stone-900 p-10 rounded-[2.5rem] border border-stone-800 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-gold via-brand-red to-brand-gold" />
                      <h4 className="font-serif font-bold text-2xl text-white tracking-tight mb-3">Engine Status</h4>
                      <div className="flex items-center gap-3 mb-6">
                          <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-full text-[9px] font-bold uppercase tracking-widest border border-emerald-500/20">Operational</span>
                          <span className="px-3 py-1 bg-brand-gold/10 text-brand-gold rounded-full text-[9px] font-bold uppercase tracking-widest border border-brand-gold/20">Real-time Monitoring</span>
                      </div>
                      <p className="text-sm text-stone-400 leading-relaxed font-serif italic">
                          The Neural Core is actively supervising the architectural integrity. 
                          Serving {((config?.aiConfig?.templates?.analysis?.length || 0) + (config?.aiConfig?.templates?.design?.length || 0))} specialized artisan prompts across the ecosystem.
                      </p>
                  </div>
              </div>
          </div>
      )}

      {activeView === 'leads' && (
          <div className="space-y-6 animate-fade-in">
              <div className="bg-white p-6 rounded-2xl border border-stone-100 shadow-sm">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-sans font-bold text-xl text-brand-dark uppercase tracking-tight flex items-center gap-2">
                        <UserCheck size={24} className="text-brand-red"/> Registered Clients ({customers.length})
                    </h3>
                    <button onClick={() => refreshData(true)} className="p-2 text-stone-300 hover:text-brand-dark transition"><RefreshCw size={16}/></button>
                  </div>

                  <div className="overflow-x-auto">
                      <table className="w-full text-left">
                          <thead>
                              <tr className="border-b border-stone-50 text-[10px] font-bold uppercase tracking-widest text-stone-300">
                                  <th className="pb-3 pl-4">Client</th>
                                  <th className="pb-3">Contact</th>
                                  <th className="pb-3">Location</th>
                                  <th className="pb-3">Joined</th>
                                  <th className="pb-3 text-right pr-4">Action</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-50">
                              {customers.length > 0 ? customers.map(c => (
                                  <tr key={c.id} className="hover:bg-stone-50 transition-colors">
                                      <td className="py-4 pl-4">
                                          <div className="flex items-center gap-3">
                                              <div className="w-8 h-8 rounded-full bg-brand-gold/10 text-brand-gold flex items-center justify-center font-bold text-xs">
                                                  {c.name.charAt(0).toUpperCase()}
                                              </div>
                                              <div>
                                                  <p className="font-bold text-brand-dark text-sm">{c.name}</p>
                                                  <p className="text-[10px] text-stone-300 uppercase font-bold tracking-tighter">{c.role}</p>
                                              </div>
                                          </div>
                                      </td>
                                      <td className="py-4 text-sm font-mono text-stone-500">{c.phone}</td>
                                      <td className="py-4 text-sm text-stone-500">{c.pincode || 'N/A'}</td>
                                      <td className="py-4 text-xs text-stone-300">{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : 'N/A'}</td>
                                      <td className="py-4 text-right pr-4">
                                          <button 
                                              onClick={() => storeService.chatWithLead(c)}
                                              className="px-3 py-1.5 bg-brand-gold/10 text-brand-gold rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-brand-gold/20 transition-colors flex items-center gap-2 ml-auto"
                                          >
                                              <MessageCircle size={14} /> Chat
                                          </button>
                                      </td>
                                  </tr>
                              )) : (
                                  <tr>
                                      <td colSpan={5} className="py-12 text-center">
                                          <UserCheck size={32} className="mx-auto text-stone-100 mb-2"/>
                                          <p className="text-stone-300 text-sm italic font-serif">No registered clients found yet.</p>
                                      </td>
                                  </tr>
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}

      {activeView === 'activity' && (
          <div className="space-y-6 animate-fade-in">
              <div className="bg-white p-6 rounded-2xl border border-stone-100 shadow-sm flex flex-col h-full min-h-[600px]">
                   <div className="flex justify-between items-center mb-6">
                        <h3 className="font-sans font-bold text-xl text-brand-dark uppercase tracking-tight flex items-center gap-2">
                            <Activity size={24} className="text-brand-red"/> Live Activity Feed
                        </h3>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase bg-stone-50 text-stone-400 px-2 py-1 rounded-lg">{analytics.length} Events</span>
                            <button onClick={() => refreshData(true)} className="p-2 text-stone-300 hover:text-brand-dark transition"><RefreshCw size={16}/></button>
                        </div>
                   </div>
                   
                   <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
                       {analytics.length === 0 ? (
                           <div className="h-full flex flex-col items-center justify-center text-stone-200">
                               <Activity size={40} className="mb-2 opacity-50"/>
                               <p className="text-sm font-serif italic">No activity recorded yet.</p>
                           </div>
                       ) : (
                           analytics.map((event, idx) => (
                               <div key={event.id || idx} className="flex gap-4 p-4 rounded-xl bg-stone-50 border border-stone-100 hover:bg-white hover:shadow-sm transition-all animate-fade-in items-center">
                                   <div className={`p-3 rounded-full shrink-0 ${
                                       event.type === 'like' ? 'bg-brand-red/5 text-brand-red' :
                                       event.type === 'inquiry' ? 'bg-brand-gold/5 text-brand-gold' :
                                       'bg-brand-dark/5 text-brand-dark'
                                   }`}>
                                       {event.type === 'like' ? <Heart size={18}/> : 
                                        event.type === 'inquiry' ? <MessageCircle size={18}/> : 
                                        <Eye size={18}/>}
                                   </div>
                                   <div className="flex-1 min-w-0">
                                       <div className="flex justify-between items-start">
                                          <p className="text-sm text-brand-dark truncate pr-2">
                                              <span className="font-bold">{event.userName || 'Guest'}</span> 
                                              {event.type === 'inquiry' ? ' inquired about' : event.type === 'like' ? ' liked' : ' viewed'} 
                                              <span className="font-bold text-brand-red"> {event.productTitle || 'an item'}</span>
                                          </p>
                                          <span className="text-[10px] text-stone-300 whitespace-nowrap flex items-center gap-1 shrink-0 font-bold uppercase tracking-tighter">
                                               <ClockIcon size={10}/> {event.timestamp ? new Date(event.timestamp).toLocaleString() : 'Just now'}
                                          </span>
                                       </div>
                                       {event.userPhone && (
                                            <p className="text-[10px] text-stone-300 font-mono mt-0.5">{event.userPhone}</p>
                                       )}
                                   </div>
                               </div>
                           ))
                       )}
                   </div>
              </div>
          </div>
      )}

      {activeView === 'trends' && (
          <div className="space-y-6 animate-fade-in">
              {/* Popular Products Calculation */}
              <div className="bg-white p-6 rounded-2xl border border-stone-100 shadow-sm min-h-[600px] flex flex-col">
                   <h3 className="font-sans font-bold text-xl text-brand-dark uppercase tracking-tight mb-6 flex items-center gap-2">
                      <TrendingUp size={24} className="text-brand-gold"/> Top Performing Assets
                   </h3>
                   <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide">
                       {trendingProducts.length === 0 ? (
                           <div className="h-full flex flex-col items-center justify-center text-stone-200">
                               <TrendingUp size={40} className="mb-2 opacity-50"/>
                               <p className="text-sm font-serif italic">Insufficient data for analysis.</p>
                           </div>
                       ) : (
                           <div className="space-y-3">
                               {trendingProducts.map((item, i) => (
                                   <div key={item.id} className="flex items-center justify-between p-4 bg-stone-50 rounded-xl border border-stone-100 hover:bg-white hover:shadow-sm transition-all group">
                                       <div className="flex items-center gap-4">
                                           <span className={`text-2xl font-sans font-bold w-12 text-center ${i < 3 ? 'text-brand-gold' : 'text-stone-200'}`}>#{i+1}</span>
                                           <div>
                                               <p className="font-bold text-brand-dark line-clamp-1 text-lg uppercase tracking-tight">{item.title}</p>
                                               <div className="flex items-center gap-4 mt-2">
                                                   <div className="flex items-center gap-2">
                                                        <div className="h-2 w-32 bg-stone-100 rounded-full overflow-hidden">
                                                            <div className="h-full bg-brand-gold" style={{ width: `${Math.min(100, item.score * 5)}%` }}></div>
                                                        </div>
                                                        <span className="text-[10px] text-stone-400 uppercase tracking-widest font-bold">Score: {item.score}</span>
                                                   </div>
                                               </div>
                                           </div>
                                       </div>
                                       <button onClick={() => navigate(`/product/${item.id}`)} className="px-4 py-2 bg-white rounded-lg border border-stone-100 text-stone-300 hover:text-brand-red hover:border-brand-red/20 transition-colors opacity-0 group-hover:opacity-100 flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                                           View Asset <ArrowRight size={14}/>
                                       </button>
                                   </div>
                               ))}
                           </div>
                       )}
                   </div>
              </div>
          </div>
      )}

      {activeView === 'files' && (
          <div className="flex-1 flex flex-col md:flex-row bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden min-h-[500px]">
             <div className="w-full md:w-56 bg-stone-50 border-r border-stone-100 flex flex-col p-3">
                 <button onClick={() => onNavigate?.('upload')} className="w-full py-2 bg-brand-dark text-white rounded-xl flex items-center justify-center gap-2 mb-3 text-[10px] font-bold uppercase tracking-widest hover:bg-brand-red transition-colors"><Plus size={16} /> Add Stock</button>
                 <div className="space-y-0.5">
                     {folders.map(folder => (
                         <button key={folder} onClick={() => setSelectedFolder(folder)} className={`w-full text-left px-3 py-1.5 rounded-lg text-[11px] flex items-center gap-2 uppercase tracking-tight font-bold transition-all ${selectedFolder === folder ? 'bg-white shadow-sm text-brand-red' : 'text-stone-400 hover:text-brand-dark'}`}>
                             <Folder size={14} />{folder}
                         </button>
                     ))}
                 </div>
             </div>
             <div className="flex-1 p-3 overflow-y-auto relative scrollbar-hide">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pb-20">
                    {allAssets.map((asset: any) => (
                        <div key={asset.assetId} 
                             onClick={() => toggleAssetSelection(asset.id)}
                             className={`relative aspect-square bg-stone-50 rounded-xl overflow-hidden border cursor-pointer group transition-all ${selectedAssets.has(asset.id) ? 'border-brand-gold ring-2 ring-brand-gold ring-offset-2' : 'border-stone-100 hover:border-brand-gold/30'}`}>
                            <img 
                                src={asset.thumbnails?.[asset.imageIndex] || asset.displayImage || ''} 
                                className={`w-full h-full object-cover transition-transform duration-500 ${selectedAssets.has(asset.id) ? 'scale-90' : 'group-hover:scale-110'}`} 
                                loading="lazy"
                            />
                            
                            <div className={`absolute top-2 right-2 w-6 h-6 rounded-full border border-white/50 flex items-center justify-center transition-colors ${selectedAssets.has(asset.id) ? 'bg-brand-gold border-brand-gold' : 'bg-black/30'}`}>
                                {selectedAssets.has(asset.id) && <CheckCircle size={14} className="text-white" />}
                            </div>

                            {asset.images.length > 1 && (
                                <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/50 backdrop-blur-md rounded text-[8px] font-bold text-white uppercase tracking-widest border border-white/10">
                                    {asset.imageIndex + 1} / {asset.images.length}
                                </div>
                            )}

                            <div className="absolute inset-x-0 bottom-0 p-2 bg-brand-dark/80 text-white text-[10px] truncate font-bold uppercase tracking-tighter">
                                {asset.title}
                            </div>
                        </div>
                    ))}
                </div>
                
                {/* Bulk Action Toolbar */}
                {selectedAssets.size > 0 && (
                    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-brand-dark text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-6 z-50 animate-in slide-in-from-bottom-4">
                        <span className="text-xs font-bold uppercase tracking-widest">{selectedAssets.size} Selected</span>
                        <div className="h-4 w-px bg-white/10"></div>
                        <button onClick={() => setIsMoveModalOpen(true)} className="flex items-center gap-2 hover:text-brand-gold transition-colors">
                            <FolderInput size={18} /> <span className="text-xs font-bold uppercase">Move</span>
                        </button>
                        <button onClick={handleBulkDelete} className="flex items-center gap-2 hover:text-brand-red transition-colors">
                            <Trash2 size={18} /> <span className="text-xs font-bold uppercase">Delete</span>
                        </button>
                        <button onClick={() => setSelectedAssets(new Set())} className="p-1 hover:bg-white/10 rounded-full">
                            <X size={16} />
                        </button>
                    </div>
                )}
             </div>
          </div>
      )}

      {/* Move Assets Modal */}
      {isMoveModalOpen && (
          <div className="fixed inset-0 z-[100] bg-brand-dark/40 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
                  <div className="p-4 border-b border-stone-100 flex justify-between items-center bg-stone-50">
                      <h3 className="font-bold text-brand-dark flex items-center gap-2 uppercase tracking-tight"><FolderInput size={18}/> Move {selectedAssets.size} Assets</h3>
                      <button onClick={() => setIsMoveModalOpen(false)}><X size={20}/></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Destination Category</label>
                          <select value={moveCategory} onChange={e => { setMoveCategory(e.target.value); setMoveSubCategory(''); }} className="w-full p-3 border border-stone-100 rounded-xl bg-stone-50 outline-none focus:ring-1 focus:ring-brand-gold">
                              <option value="">Select Category...</option>
                              {config?.categories?.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                          </select>
                      </div>
                      
                      {activeSubCategories.length > 0 && (
                          <div>
                              <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Sub-Category</label>
                              <select value={moveSubCategory} onChange={e => setMoveSubCategory(e.target.value)} className="w-full p-3 border border-stone-100 rounded-xl bg-stone-50 outline-none focus:ring-1 focus:ring-brand-gold">
                                  <option value="">Select Sub-Category...</option>
                                  {activeSubCategories.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                              </select>
                          </div>
                      )}

                      <button onClick={handleBulkMove} disabled={!moveCategory} className="w-full py-3 bg-brand-dark text-white rounded-xl font-bold uppercase tracking-widest disabled:opacity-50 hover:bg-brand-red transition-colors">
                          Confirm Move
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

// Helper Icon for Timestamp
const ClockIcon = ({size}: {size: number}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
);

export default AdminDashboard;
