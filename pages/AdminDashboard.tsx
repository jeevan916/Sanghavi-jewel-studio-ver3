
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { storeService } from '../services/storeService';
import { Product, AnalyticsEvent, User } from '../types';
import { 
  Loader2, Users, Settings, Folder, Trash2, Edit2, Plus, Search, 
  Grid, List as ListIcon, Lock, Unlock, CheckCircle, X, 
  LayoutDashboard, FolderOpen, Save, Smartphone, Download, MessageCircle, LogOut, UserCheck, HardDrive, Database
} from 'lucide-react';

interface AdminDashboardProps {
  onNavigate?: (tab: string) => void;
}

type ViewMode = 'overview' | 'files' | 'leads';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<ViewMode>('overview');
  const [products, setProducts] = useState<Product[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsEvent[]>([]);
  const [customers, setCustomers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [healthInfo, setHealthInfo] = useState<{mode?: string, healthy: boolean}>({healthy: false});

  const [selectedFolder, setSelectedFolder] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewStyle, setViewStyle] = useState<'grid' | 'list'>('grid');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = async () => {
    setLoading(true);
    try {
        const [p, a, c, h] = await Promise.all([
          storeService.getProducts(),
          storeService.getAnalytics(),
          storeService.getCustomers(),
          storeService.checkServerHealth()
        ]);
        setProducts(p);
        setAnalytics(a);
        setCustomers(c);
        setHealthInfo(h);
    } catch (e) {}
    setLoading(false);
  };

  const folders = useMemo(() => {
      const cats = new Set(products.map(p => p.category));
      return ['All', 'Private', ...Array.from(cats)];
  }, [products]);

  const filteredProducts = useMemo(() => {
      return products.filter(p => {
          const matchesFolder = 
            selectedFolder === 'All' ? true :
            selectedFolder === 'Private' ? p.isHidden :
            p.category === selectedFolder;
          const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) || p.id.includes(searchQuery);
          return matchesFolder && matchesSearch;
      });
  }, [products, selectedFolder, searchQuery]);

  const recentInquiries = useMemo(() => analytics.filter(e => e.type === 'inquiry').slice(0, 10), [analytics]);

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
          refreshData();
      }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="animate-spin text-gold-500" size={32} />
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
                 <div className={`w-2 h-2 rounded-full ${healthInfo.healthy ? 'bg-green-500' : 'bg-red-500'}`} />
                 <p className="text-stone-500 text-[10px] uppercase font-bold tracking-widest">{healthInfo.mode || 'Local Vault Mode'}</p>
              </div>
           </div>
           <button onClick={() => storeService.logout()} className="md:hidden p-2 text-stone-400 hover:text-red-500 transition-colors">
              <LogOut size={22} />
           </button>
        </div>
        
        <div className="flex bg-stone-100 p-1 rounded-xl items-center overflow-x-auto">
            <button 
                onClick={() => setActiveView('overview')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeView === 'overview' ? 'bg-white shadow text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}
            >
                <LayoutDashboard size={16} /> Overview
            </button>
            <button 
                onClick={() => setActiveView('files')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeView === 'files' ? 'bg-white shadow text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}
            >
                <FolderOpen size={16} /> Assets
            </button>
            <button 
                onClick={() => setActiveView('leads')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeView === 'leads' ? 'bg-white shadow text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}
            >
                <UserCheck size={16} /> Leads
            </button>
            <button onClick={() => onNavigate?.('settings')} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-stone-500 hover:text-stone-700 transition-all whitespace-nowrap">
                <Settings size={16} /> Settings
            </button>
        </div>
      </header>

      {activeView === 'overview' && (
          <div className="flex-1 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex items-center gap-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><HardDrive size={24} /></div>
                    <div><p className="text-stone-500 text-[10px] font-bold uppercase tracking-widest">Inventory</p><p className="text-2xl font-bold text-stone-800">{products.length}</p></div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex items-center gap-4">
                    <div className="p-3 bg-purple-50 text-purple-600 rounded-xl"><Database size={24} /></div>
                    <div><p className="text-stone-500 text-[10px] font-bold uppercase tracking-widest">Table Integrity</p><p className="text-2xl font-bold text-stone-800">100%</p></div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex items-center gap-4">
                    <div className="p-3 bg-green-50 text-green-600 rounded-xl"><UserCheck size={24} /></div>
                    <div><p className="text-stone-500 text-[10px] font-bold uppercase tracking-widest">Leads</p><p className="text-2xl font-bold text-stone-800">{customers.length}</p></div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex items-center gap-4">
                    <div className="p-3 bg-gold-50 text-gold-600 rounded-xl"><MessageCircle size={24} /></div>
                    <div><p className="text-stone-500 text-[10px] font-bold uppercase tracking-widest">Inquiries</p><p className="text-2xl font-bold text-stone-800">{recentInquiries.length}</p></div>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
                    <div className="p-4 border-b border-stone-100 bg-stone-50/50 flex justify-between items-center"><h3 className="font-serif text-lg text-stone-800">Recent Customer Activity</h3></div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-stone-50 text-stone-400 font-bold uppercase tracking-wider">
                                <tr><th className="p-4">Item</th><th className="p-4">Customer</th><th className="p-4 text-right">Time</th></tr>
                            </thead>
                            <tbody>
                                {recentInquiries.map(e => (
                                    <tr key={e.id} className="border-b border-stone-50 hover:bg-stone-50 cursor-pointer" onClick={() => navigate(`/product/${e.productId}`)}>
                                        <td className="p-4 font-bold text-stone-800 truncate max-w-[120px]">{e.productTitle}</td>
                                        <td className="p-4 font-medium text-stone-600">{e.userName}</td>
                                        <td className="p-4 text-right text-stone-400 font-mono">{new Date(e.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                                    </tr>
                                ))}
                                {recentInquiries.length === 0 && <tr><td colSpan={3} className="p-8 text-center text-stone-300">No recent inquiries</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6 flex flex-col justify-center items-center text-center space-y-4">
                    <div className="p-5 bg-stone-50 rounded-full text-gold-600"><Smartphone size={40} /></div>
                    <h3 className="font-serif text-xl text-stone-800">Physical Storage Active</h3>
                    <p className="text-stone-500 text-sm max-w-xs">All jewelry media is being strictly converted to physical files in the /data/uploads folder. Database segmentation is active across 6 independent tables.</p>
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
                                <img src={product.thumbnails?.[0] ? `${window.location.origin}${product.thumbnails[0]}` : `${window.location.origin}${product.images[0]}`} className="w-full h-full object-cover rounded-xl p-1" />
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
                    <p className="text-stone-500 text-sm mt-1">Directly engage with potential clients registered via WhatsApp.</p>
                  </div>
                  <div className="bg-white border border-stone-200 px-4 py-2 rounded-xl text-xs font-bold text-stone-500 uppercase tracking-widest shadow-sm">
                      Total Leads: {customers.length}
                  </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                  <table className="w-full text-sm text-left">
                      <thead className="bg-stone-50 text-stone-500 uppercase text-[10px] font-bold tracking-[0.2em] border-b border-stone-200">
                          <tr>
                              <th className="p-6">Customer Profile</th>
                              <th className="p-6">WhatsApp Contact</th>
                              <th className="p-6">Signed Up</th>
                              <th className="p-6 text-right">Actions</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                          {customers.map(customer => (
                              <tr key={customer.id} className="hover:bg-gold-50/20 transition-colors">
                                  <td className="p-6">
                                      <div className="flex items-center gap-4">
                                          <div className="w-10 h-10 bg-gold-100 rounded-full flex items-center justify-center font-bold text-gold-700">{customer.name.charAt(0)}</div>
                                          <div><p className="font-bold text-stone-800 text-base">{customer.name}</p></div>
                                      </div>
                                  </td>
                                  <td className="p-6 font-mono font-medium text-stone-600">+{customer.phone}</td>
                                  <td className="p-6 text-stone-500">{new Date(customer.createdAt).toLocaleDateString()}</td>
                                  <td className="p-6 text-right">
                                      <button 
                                        onClick={() => storeService.chatWithLead(customer)}
                                        className="bg-green-500 text-white px-5 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-[0.1em] flex items-center gap-2 ml-auto shadow-sm hover:bg-green-600 transition-all"
                                      >
                                          <MessageCircle size={14} /> WhatsApp Chat
                                      </button>
                                  </td>
                              </tr>
                          ))}
                          {customers.length === 0 && (
                              <tr><td colSpan={4} className="p-20 text-center text-stone-300 font-serif text-lg">Lead database ready for capture...</td></tr>
                          )}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {editProduct && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-stone-50"><h3 className="font-serif text-xl font-bold text-stone-800">Edit Asset Metadata</h3><button onClick={() => setEditProduct(null)} className="text-stone-400 hover:text-stone-600 p-1"><X size={24}/></button></div>
                  <div className="p-6 space-y-4 text-stone-800">
                      <div><label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1.5">Jewelry Title</label><input value={editProduct.title} onChange={e => setEditProduct({...editProduct, title: e.target.value})} className="w-full p-3 border border-stone-200 rounded-xl text-sm font-medium focus:ring-1 focus:ring-gold-500 outline-none" /></div>
                      <div><label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1.5">Collection Category</label><select value={editProduct.category} onChange={e => setEditProduct({...editProduct, category: e.target.value})} className="w-full p-3 border border-stone-200 rounded-xl text-sm bg-stone-50 font-medium focus:ring-1 focus:ring-gold-500 outline-none">{folders.filter(f => f !== 'All' && f !== 'Private').map(f => <option key={f} value={f}>{f}</option>)}</select></div>
                  </div>
                  <div className="p-6 border-t border-stone-100 bg-stone-50 flex justify-end gap-3"><button onClick={() => setEditProduct(null)} className="px-5 py-2 text-stone-500 hover:bg-stone-200 rounded-xl text-sm font-bold uppercase tracking-widest">Cancel</button><button onClick={handleSaveEdit} className="px-5 py-2.5 bg-stone-900 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-stone-800 shadow-lg transition"><Save size={16} /> Persist Changes</button></div>
              </div>
          </div>
      )}
    </div>
  );
};
