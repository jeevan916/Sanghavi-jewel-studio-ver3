
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { storeService } from '../services/storeService';
import { Product, AnalyticsEvent, User } from '../types';
import { 
  Loader2, Settings, Folder, Trash2, Edit2, Plus, Search, 
  Grid, List as ListIcon, Lock, CheckCircle, X, 
  LayoutDashboard, FolderOpen, UserCheck, HardDrive, Database, RefreshCw, TrendingUp, BrainCircuit, MapPin, DollarSign, Smartphone, MessageCircle, Save, AlertTriangle
} from 'lucide-react';

interface AdminDashboardProps {
  onNavigate?: (tab: string) => void;
}

type ViewMode = 'overview' | 'files' | 'leads' | 'trends' | 'intelligence';

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
            setProducts(pRes.items || []);
            setAnalytics(a || []);
            setCustomers(c || []);
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
      const cats = new Set(products.map(p => p.category).filter(Boolean));
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
    return analytics.filter(e => e.type === 'inquiry').slice(0, 10);
  }, [analytics]);

  const trendingProducts = useMemo(() => {
      if (!Array.isArray(analytics) || !Array.isArray(products)) return [];
      const scores: Record<string, number> = {};
      analytics.forEach(e => {
          if (!e.productId) return;
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
              const product = products.find(p => p.id === id);
              return product ? { ...product, score: scores[id] } : null;
          })
          .filter(Boolean) as (Product & { score: number })[];
  }, [analytics, products]);

  const handleSelect = (id: string, multi: boolean) => {
      if (multi) {
          const newSet = new Set(selectedIds);
          if (newSet.has(id)) newSet.delete(id);
          else newSet.add(id);
          setSelectedIds(newSet);
      } else {
          setSelectedIds(new Set([id]));
      }
  };

  const handleSaveEdit = async () => {
      if (editProduct) {
          await storeService.updateProduct(editProduct);
          setEditProduct(null);
          refreshData(true);
      }
  };

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
                 {!healthInfo.healthy && (
                     <button onClick={() => refreshData()} className="ml-2 text-[10px] text-red-500 hover:text-red-700 font-bold underline flex items-center gap-1">
                         <RefreshCw size={10} /> Force Reconnect
                     </button>
                 )}
              </div>
           </div>
        </div>
        
        <div className="flex bg-stone-100 p-1 rounded-xl items-center overflow-x-auto">
            {[
              { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
              { id: 'files', icon: FolderOpen, label: 'Assets' },
              { id: 'leads', icon: UserCheck, label: 'Leads' },
              { id: 'trends', icon: TrendingUp, label: 'Trends' },
              { id: 'intelligence', icon: BrainCircuit, label: 'AI Intel' },
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveView(tab.id as ViewMode)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeView === tab.id ? 'bg-white shadow text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}
              >
                  <tab.icon size={16} /> {tab.label}
              </button>
            ))}
            <button onClick={() => onNavigate?.('settings')} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-stone-500 hover:text-stone-700 transition-all whitespace-nowrap">
                <Settings size={16} /> Settings
            </button>
        </div>
      </header>

      {healthInfo.healthy === false && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700">
              <AlertTriangle size={20} />
              <div>
                  <p className="font-bold text-sm">Connection Lost</p>
                  <p className="text-xs">The application cannot reach the MySQL database. We are attempting to reconnect automatically.</p>
              </div>
          </div>
      )}

      {activeView === 'overview' && (
          <div className="flex-1 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex items-center gap-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><HardDrive size={24} /></div>
                    <div><p className="text-stone-500 text-[10px] font-bold uppercase tracking-widest">Inventory</p><p className="text-2xl font-bold text-stone-800">{products.length}</p></div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex items-center gap-4">
                    <div className="p-3 bg-purple-50 text-purple-600 rounded-xl"><Database size={24} /></div>
                    <div><p className="text-stone-500 text-[10px] font-bold uppercase tracking-widest">Integrity</p><p className="text-2xl font-bold text-stone-800">{healthInfo.healthy ? '100%' : 'Offline'}</p></div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex items-center gap-4">
                    <div className="p-3 bg-green-50 text-green-600 rounded-xl"><UserCheck size={24} /></div>
                    <div><p className="text-stone-500 text-[10px] font-bold uppercase tracking-widest">Leads</p><p className="text-2xl font-bold text-stone-800">{customers.length}</p></div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex items-center gap-4">
                    <div className="p-3 bg-gold-50 text-gold-600 rounded-xl"><TrendingUp size={24} /></div>
                    <div><p className="text-stone-500 text-[10px] font-bold uppercase tracking-widest">Inquiries</p><p className="text-2xl font-bold text-stone-800">{recentInquiries.length}</p></div>
                </div>
            </div>
          </div>
      )}

      {activeView === 'intelligence' && intelligence && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
                    <h3 className="font-serif text-xl text-stone-800 flex items-center gap-2 mb-4">
                        <DollarSign className="text-green-600" size={20} /> Spending Power Prediction
                    </h3>
                    <div className="space-y-3">
                        {intelligence.spendingPower?.map((area: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-100">
                                <div className="flex items-center gap-3">
                                    <div className="bg-green-100 text-green-700 font-bold p-2 rounded-lg text-xs">#{idx+1}</div>
                                    <div>
                                        <p className="font-bold text-stone-800">Pincode {area.pincode || 'Unknown'}</p>
                                        <p className="text-xs text-stone-500">{area.interaction_count} Signals</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-mono font-bold text-green-700">{parseFloat(area.avg_weight_interest || 0).toFixed(1)}g</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
                     <h3 className="font-serif text-xl text-stone-800 flex items-center gap-2 mb-4">
                        <Smartphone className="text-blue-600" size={20} /> Tech Stats
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                         {intelligence.devices?.map((dev: any, idx: number) => (
                             <div key={idx} className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex flex-col items-center justify-center text-center">
                                 <p className="font-bold text-lg text-blue-900">{dev.user_count}</p>
                                 <p className="text-xs font-bold uppercase tracking-widest text-blue-400">{dev.os}</p>
                             </div>
                         ))}
                    </div>
                </div>
            </div>
        </div>
      )}

      {activeView === 'files' && (
          <div className="flex-1 flex flex-col md:flex-row bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden min-h-[500px]">
             <div className="w-full md:w-64 bg-stone-50 border-r border-stone-200 flex flex-col">
                 <div className="p-4 border-b border-stone-200"><button onClick={() => onNavigate?.('upload')} className="w-full py-2.5 bg-stone-900 text-white rounded-xl flex items-center justify-center gap-2 shadow-sm hover:bg-stone-800 transition text-sm font-bold uppercase tracking-widest"><Plus size={18} /> Add Stock</button></div>
                 <div className="flex-1 p-2 space-y-1">
                     {folders.map(folder => (
                         <button key={folder} onClick={() => { setSelectedFolder(folder); setSelectedIds(new Set()); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-3 transition-colors ${selectedFolder === folder ? 'bg-white shadow-sm text-gold-700 font-bold' : 'text-stone-500 hover:bg-stone-100'}`}>
                             {folder === 'Private' ? <Lock size={16} /> : <Folder size={16} />}{folder}
                         </button>
                     ))}
                 </div>
             </div>
             <div className="flex-1 flex flex-col h-full min-h-0">
                 <div className="p-4 border-b border-stone-200 flex items-center justify-between gap-4 bg-white">
                     <div className="flex-1 max-w-md relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} /><input type="text" placeholder="Filter jewelry..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-100 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-gold-400" /></div>
                     <div className="flex items-center gap-2"><button onClick={() => setViewStyle('grid')} className={`p-2 rounded ${viewStyle === 'grid' ? 'bg-stone-100 text-stone-900' : 'text-stone-400'}`}><Grid size={18}/></button><button onClick={() => setViewStyle('list')} className={`p-2 rounded ${viewStyle === 'list' ? 'bg-stone-100 text-stone-900' : 'text-stone-400'}`}><ListIcon size={18}/></button></div>
                 </div>
                 <div className="flex-1 overflow-y-auto p-4 bg-stone-50/50">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {filteredProducts.map(product => (
                            <div key={product.id} onClick={(e) => handleSelect(product.id, e.ctrlKey || e.metaKey)} onDoubleClick={() => navigate(`/product/${product.id}`)} className={`group relative aspect-square bg-white rounded-xl shadow-sm border cursor-pointer transition-all ${selectedIds.has(product.id) ? 'border-gold-500 ring-2 ring-gold-200' : 'border-stone-200 hover:border-gold-300'}`}>
                                <img src={product.thumbnails?.[0] || product.images?.[0] || ''} className="w-full h-full object-cover rounded-xl p-1" />
                                <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent rounded-b-xl"><p className="text-white text-[10px] truncate font-bold uppercase tracking-wider">{product.title}</p></div>
                                <button onClick={(e) => { e.stopPropagation(); setEditProduct(product); }} className="absolute top-2 right-2 bg-white/90 p-1.5 rounded-full text-stone-600 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10"><Edit2 size={12} /></button>
                                {selectedIds.has(product.id) && <div className="absolute top-2 left-2 bg-gold-600 text-white rounded-full p-0.5 shadow-sm"><CheckCircle size={14} /></div>}
                            </div>
                        ))}
                    </div>
                 </div>
             </div>
          </div>
      )}

      {activeView === 'leads' && (
          <div className="flex-1 bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden flex flex-col">
              <div className="p-6 bg-stone-50 border-b border-stone-200 flex justify-between items-end">
                  <div>
                    <h3 className="font-serif text-2xl text-stone-800 flex items-center gap-2"><UserCheck className="text-gold-600" /> Customer Insights</h3>
                    <p className="text-stone-500 text-sm mt-1">Engage with registered clients.</p>
                  </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                  <table className="w-full text-sm text-left">
                      <thead className="bg-stone-50 text-stone-500 uppercase text-[10px] font-bold tracking-[0.2em] border-b border-stone-200">
                          <tr>
                              <th className="p-6">Profile</th>
                              <th className="p-6">Contact</th>
                              <th className="p-6 text-right">Actions</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                          {customers.map(customer => (
                              <tr key={customer.id} className="hover:bg-gold-50/20 transition-colors">
                                  <td className="p-6 font-bold">{customer.name}</td>
                                  <td className="p-6 font-mono text-stone-600">+{customer.phone}</td>
                                  <td className="p-6 text-right">
                                      <button onClick={() => storeService.chatWithLead(customer)} className="bg-green-500 text-white px-5 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-[0.1em] shadow-sm">Chat</button>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {activeView === 'trends' && (
          <div className="flex-1 bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden flex flex-col">
               <div className="p-6 bg-stone-50 border-b border-stone-200">
                  <h3 className="font-serif text-2xl text-stone-800 flex items-center gap-2"><TrendingUp className="text-gold-600" /> Market Trends</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-6 bg-stone-50/50">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {trendingProducts.map((p, index) => (
                          <div key={p.id} onClick={() => navigate(`/product/${p.id}`)} className="bg-white rounded-xl shadow-sm border border-stone-100 flex overflow-hidden cursor-pointer hover:shadow-md transition">
                               <div className="w-24 h-24 shrink-0 bg-stone-200">
                                   <img src={p.thumbnails?.[0] || p.images?.[0] || ''} className="w-full h-full object-cover" />
                               </div>
                               <div className="p-4 flex-1 flex flex-col justify-center">
                                   <span className="text-[10px] font-bold uppercase tracking-widest text-gold-600">#{index + 1} Trending</span>
                                   <h4 className="font-serif font-bold text-stone-800 truncate">{p.title}</h4>
                                   <p className="text-xs text-stone-500">Score: {p.score}</p>
                               </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {editProduct && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
                  <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-stone-50"><h3 className="font-serif text-xl font-bold text-stone-800">Edit Metadata</h3><button onClick={() => setEditProduct(null)} className="text-stone-400 hover:text-stone-600"><X size={24}/></button></div>
                  <div className="p-6 space-y-4 text-stone-800">
                      <div><label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1.5">Jewelry Title</label><input value={editProduct.title} onChange={e => setEditProduct({...editProduct, title: e.target.value})} className="w-full p-3 border border-stone-200 rounded-xl" /></div>
                  </div>
                  <div className="p-6 border-t border-stone-100 bg-stone-50 flex justify-end gap-3"><button onClick={() => setEditProduct(null)} className="px-5 py-2 text-stone-500 font-bold uppercase tracking-widest">Cancel</button><button onClick={handleSaveEdit} className="px-5 py-2.5 bg-stone-900 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">Save</button></div>
              </div>
          </div>
      )}
    </div>
  );
};
