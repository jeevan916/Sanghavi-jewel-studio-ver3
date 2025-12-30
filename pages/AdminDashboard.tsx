
import React, { useEffect, useState, useMemo } from 'react';
import { storeService } from '../services/storeService';
import { Product, AnalyticsEvent } from '../types';
import { 
  Loader2, TrendingUp, BarChart3, Users, Settings, 
  Folder, Image as ImageIcon, Trash2, Edit2, Plus, Search, 
  Grid, List as ListIcon, Lock, Unlock, CheckCircle, X, 
  LayoutDashboard, FolderOpen, Save, FolderInput, Smartphone, Eye, Download, MessageCircle, LogOut
} from 'lucide-react';

interface AdminDashboardProps {
  onNavigate?: (tab: string) => void;
}

type ViewMode = 'overview' | 'files';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  const [activeView, setActiveView] = useState<ViewMode>('overview');
  const [products, setProducts] = useState<Product[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // --- File Browser State ---
  const [selectedFolder, setSelectedFolder] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewStyle, setViewStyle] = useState<'grid' | 'list'>('grid');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  
  // Move Modal State
  const [showMoveModal, setShowMoveModal] = useState(false);

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = async () => {
    setLoading(true);
    const p = await storeService.getProducts();
    const a = await storeService.getAnalytics();
    setProducts(p);
    setAnalytics(a);
    setLoading(false);
  };

  // --- Computed Data ---
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
          
          const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                p.id.includes(searchQuery);
          
          return matchesFolder && matchesSearch;
      });
  }, [products, selectedFolder, searchQuery]);

  // Analytics Computed
  const recentInquiries = useMemo(() => analytics.filter(e => e.type === 'inquiry').slice(0, 10), [analytics]);
  const recentScreenshots = useMemo(() => analytics.filter(e => e.type === 'screenshot').slice(0, 10), [analytics]);

  // --- Handlers ---
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

  const handleDeleteSelected = async () => {
      if (!window.confirm(`Delete ${selectedIds.size} items permanently?`)) return;
      
      const idsToDelete: string[] = Array.from(selectedIds);
      for (const id of idsToDelete) {
          await storeService.deleteProduct(id);
      }
      setSelectedIds(new Set());
      refreshData();
  };

  const handleTogglePrivacy = async (status: boolean) => {
      const ids = Array.from(selectedIds);
      const updatedList = products.map(p => {
          if (ids.includes(p.id)) {
              const updated = { ...p, isHidden: status };
              storeService.updateProduct(updated); // Async update
              return updated;
          }
          return p;
      });
      setProducts(updatedList);
      setSelectedIds(new Set());
  };

  const handleMoveSelected = async (targetCategory: string) => {
      const ids = Array.from(selectedIds);
      const updatedList = products.map(p => {
          if (ids.includes(p.id)) {
              const updated = { ...p, category: targetCategory };
              storeService.updateProduct(updated);
              return updated;
          }
          return p;
      });
      setProducts(updatedList);
      setSelectedIds(new Set());
      setShowMoveModal(false);
  };

  const handleSaveEdit = async () => {
      if (editProduct) {
          await storeService.updateProduct(editProduct);
          setEditProduct(null);
          refreshData();
      }
  };

  const handleLogout = () => {
    storeService.logout();
  };

  // --- RENDER ---

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 md:pt-24 pb-24 h-screen flex flex-col">
      <header className="flex-none mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex justify-between items-start w-full md:w-auto">
           <div>
              <h2 className="font-serif text-3xl text-gold-700">Admin Dashboard</h2>
              <p className="text-stone-500 text-sm">Manage inventory, privacy, and insights.</p>
           </div>
           <button onClick={handleLogout} className="md:hidden p-2 text-stone-400 hover:text-red-500 transition-colors">
              <LogOut size={22} />
           </button>
        </div>
        
        <div className="flex bg-stone-100 p-1 rounded-lg items-center">
            <button 
                onClick={() => setActiveView('overview')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeView === 'overview' ? 'bg-white shadow text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}
            >
                <LayoutDashboard size={16} /> Overview
            </button>
            <button 
                onClick={() => setActiveView('files')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeView === 'files' ? 'bg-white shadow text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}
            >
                <FolderOpen size={16} /> Media Library
            </button>
            <button 
                onClick={() => onNavigate?.('settings')}
                className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-stone-500 hover:text-stone-700 transition-all"
            >
                <Settings size={16} /> Settings
            </button>
            <div className="hidden md:block h-6 w-px bg-stone-300 mx-2" />
            <button 
                onClick={handleLogout}
                className="hidden md:flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold text-red-500 hover:bg-red-50 transition-all"
            >
                <LogOut size={16} /> Logout
            </button>
        </div>
      </header>

      {/* ================= OVERVIEW VIEW ================= */}
      {activeView === 'overview' && (
          <div className="flex-1 overflow-y-auto space-y-6">
             {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex items-center gap-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Users size={24} /></div>
                    <div>
                        <p className="text-stone-500 text-sm">Total Products</p>
                        <p className="text-2xl font-bold text-stone-800">{products.length}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex items-center gap-4">
                    <div className="p-3 bg-purple-50 text-purple-600 rounded-xl"><Lock size={24} /></div>
                    <div>
                        <p className="text-stone-500 text-sm">Private Items</p>
                        <p className="text-2xl font-bold text-stone-800">{products.filter(p => p.isHidden).length}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex items-center gap-4">
                    <div className="p-3 bg-green-50 text-green-600 rounded-xl"><MessageCircle size={24} /></div>
                    <div>
                        <p className="text-stone-500 text-sm">Total Inquiries</p>
                        <p className="text-2xl font-bold text-stone-800">{analytics.filter(e => e.type === 'inquiry').length}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex items-center gap-4">
                    <div className="p-3 bg-gold-50 text-gold-600 rounded-xl"><Download size={24} /></div>
                    <div>
                        <p className="text-stone-500 text-sm">Total Captures</p>
                        <p className="text-2xl font-bold text-stone-800">{analytics.filter(e => e.type === 'screenshot').length}</p>
                    </div>
                </div>
            </div>

            {/* Traffic Insights Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Recent Inquiries */}
                <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-stone-100 bg-gradient-to-r from-green-50 to-white flex justify-between items-center">
                        <h3 className="font-serif text-lg text-stone-800 flex items-center gap-2">
                            <MessageCircle className="text-green-600" size={18} />
                            Recent Inquiries
                        </h3>
                        <span className="text-xs text-stone-400">Last 10</span>
                    </div>
                    <div className="flex-1 overflow-auto max-h-[300px]">
                        {recentInquiries.length === 0 ? (
                            <div className="p-8 text-center text-stone-400 text-sm">No inquiries yet.</div>
                        ) : (
                            <table className="w-full text-sm text-left">
                                <thead className="bg-stone-50 text-stone-500 font-medium sticky top-0">
                                    <tr>
                                        <th className="p-3">Product</th>
                                        <th className="p-3">User & Device</th>
                                        <th className="p-3 text-right">Time</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentInquiries.map(e => (
                                        <tr key={e.id} className="border-b border-stone-100 hover:bg-stone-50">
                                            <td className="p-3 font-medium text-stone-700 truncate max-w-[120px]" title={e.productTitle}>
                                                {e.productTitle}
                                            </td>
                                            <td className="p-3">
                                                <div className="flex flex-col">
                                                    <span className="text-stone-800 font-medium flex items-center gap-1">
                                                        <Users size={12}/> {e.userName}
                                                    </span>
                                                    <span className="text-xs text-stone-400 flex items-center gap-1">
                                                        <Smartphone size={10}/> {e.deviceName}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-3 text-right text-stone-400 text-xs">
                                                {new Date(e.timestamp).toLocaleDateString()} <br/>
                                                {new Date(e.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* Screenshots / Downloads */}
                <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-stone-100 bg-gradient-to-r from-gold-50 to-white flex justify-between items-center">
                        <h3 className="font-serif text-lg text-stone-800 flex items-center gap-2">
                            <Download className="text-gold-600" size={18} />
                            Product Captures
                        </h3>
                        <span className="text-xs text-stone-400">Last 10 Downloads</span>
                    </div>
                    <div className="flex-1 overflow-auto max-h-[300px]">
                        {recentScreenshots.length === 0 ? (
                            <div className="p-8 text-center text-stone-400 text-sm">No captures yet.</div>
                        ) : (
                            <table className="w-full text-sm text-left">
                                <thead className="bg-stone-50 text-stone-500 font-medium sticky top-0">
                                    <tr>
                                        <th className="p-3">Product</th>
                                        <th className="p-3">User & Device</th>
                                        <th className="p-3 text-right">Time</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentScreenshots.map(e => (
                                        <tr key={e.id} className="border-b border-stone-100 hover:bg-stone-50">
                                            <td className="p-3 font-medium text-stone-700 truncate max-w-[120px]" title={e.productTitle}>
                                                {e.productTitle}
                                            </td>
                                            <td className="p-3">
                                                <div className="flex flex-col">
                                                    <span className="text-stone-800 font-medium flex items-center gap-1">
                                                        <Users size={12}/> {e.userName}
                                                    </span>
                                                    <span className="text-xs text-stone-400 flex items-center gap-1">
                                                        <Smartphone size={10}/> {e.deviceName}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-3 text-right text-stone-400 text-xs">
                                                {new Date(e.timestamp).toLocaleDateString()} <br/>
                                                {new Date(e.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

            </div>
          </div>
      )}

      {/* ================= FILE MANAGER VIEW ================= */}
      {activeView === 'files' && (
          <div className="flex-1 flex flex-col md:flex-row bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
             
             {/* --- SIDEBAR --- */}
             <div className="w-full md:w-64 bg-stone-50 border-r border-stone-200 flex flex-col max-h-[200px] md:max-h-full overflow-y-auto">
                 <div className="p-4 border-b border-stone-200 sticky top-0 bg-stone-50 z-10">
                     <button 
                        onClick={() => onNavigate?.('upload')}
                        className="w-full py-2 bg-gold-600 text-white rounded-lg flex items-center justify-center gap-2 shadow-sm hover:bg-gold-700 transition"
                     >
                         <Plus size={18} /> Add Photos
                     </button>
                 </div>
                 <div className="flex-1 p-2 space-y-1">
                     {folders.map(folder => (
                         <button
                            key={folder}
                            onClick={() => { setSelectedFolder(folder); setSelectedIds(new Set()); }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-3 transition-colors ${
                                selectedFolder === folder ? 'bg-white shadow-sm text-gold-700 font-medium' : 'text-stone-600 hover:bg-stone-100'
                            }`}
                         >
                             {folder === 'Private' ? <Lock size={16} /> : <Folder size={16} />}
                             {folder}
                         </button>
                     ))}
                 </div>
             </div>

             {/* --- MAIN CONTENT --- */}
             <div className="flex-1 flex flex-col h-full min-h-0">
                 {/* Toolbar */}
                 <div className="p-4 border-b border-stone-200 flex items-center justify-between gap-4 bg-white z-10">
                     <div className="flex items-center gap-2 flex-1 max-w-md">
                         <div className="relative flex-1">
                             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                             <input 
                                type="text" 
                                placeholder="Search files..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-gold-400"
                             />
                         </div>
                     </div>
                     <div className="flex items-center gap-2">
                         <div className="h-8 w-px bg-stone-200 mx-1"></div>
                         <button onClick={() => setViewStyle('grid')} className={`p-2 rounded ${viewStyle === 'grid' ? 'bg-stone-100 text-stone-900' : 'text-stone-400'}`}><Grid size={18}/></button>
                         <button onClick={() => setViewStyle('list')} className={`p-2 rounded ${viewStyle === 'list' ? 'bg-stone-100 text-stone-900' : 'text-stone-400'}`}><ListIcon size={18}/></button>
                     </div>
                 </div>

                 {/* Actions Bar (Appears when items selected) */}
                 {selectedIds.size > 0 && (
                     <div className="bg-gold-50 px-4 py-2 border-b border-gold-100 flex items-center justify-between text-sm text-gold-800 animate-in slide-in-from-top-2 overflow-x-auto">
                         <span className="font-medium whitespace-nowrap mr-4">{selectedIds.size} selected</span>
                         <div className="flex gap-2">
                             <button onClick={() => setShowMoveModal(true)} className="flex items-center gap-1 px-3 py-1 bg-white border border-gold-200 rounded hover:bg-gold-100 whitespace-nowrap"><FolderInput size={14}/> Move</button>
                             <button onClick={() => handleTogglePrivacy(true)} className="flex items-center gap-1 px-3 py-1 bg-white border border-gold-200 rounded hover:bg-gold-100 whitespace-nowrap"><Lock size={14}/> Lock</button>
                             <button onClick={() => handleTogglePrivacy(false)} className="flex items-center gap-1 px-3 py-1 bg-white border border-gold-200 rounded hover:bg-gold-100 whitespace-nowrap"><Unlock size={14}/> Unlock</button>
                             <button onClick={handleDeleteSelected} className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 border border-red-200 rounded hover:bg-red-200 whitespace-nowrap"><Trash2 size={14}/> Delete</button>
                         </div>
                     </div>
                 )}

                 {/* Files Area */}
                 <div className="flex-1 overflow-y-auto p-4 bg-stone-50/50">
                     {filteredProducts.length === 0 ? (
                         <div className="h-full flex flex-col items-center justify-center text-stone-400">
                             <FolderOpen size={48} className="mb-2 opacity-20" />
                             <p>No files found in this folder</p>
                         </div>
                     ) : (
                         viewStyle === 'grid' ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                {filteredProducts.map(product => (
                                    <div 
                                        key={product.id}
                                        onClick={(e) => handleSelect(product.id, e.ctrlKey || e.metaKey || true)} // Simple click now selects to make it easier on mobile
                                        onDoubleClick={() => setEditProduct(product)}
                                        className={`group relative aspect-square bg-white rounded-xl shadow-sm border cursor-pointer transition-all ${
                                            selectedIds.has(product.id) ? 'border-gold-500 ring-2 ring-gold-200' : 'border-stone-200 hover:border-gold-300'
                                        }`}
                                    >
                                        <img src={product.images[0]} className="w-full h-full object-cover rounded-xl p-1" />
                                        
                                        {/* Overlay Info */}
                                        <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/60 to-transparent rounded-b-xl">
                                            <p className="text-white text-xs truncate font-medium">{product.title}</p>
                                        </div>

                                        {/* Status Icons */}
                                        {product.isHidden && (
                                            <div className="absolute top-2 right-2 bg-black/50 p-1 rounded-full text-white backdrop-blur">
                                                <Lock size={10} />
                                            </div>
                                        )}
                                        
                                        {/* Edit Button (Mobile Friendly) */}
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setEditProduct(product); }}
                                            className="absolute top-2 right-2 bg-white/90 p-1.5 rounded-full text-stone-600 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10"
                                        >
                                            <Edit2 size={12} />
                                        </button>
                                        
                                        {/* Selection Check */}
                                        {selectedIds.has(product.id) && (
                                            <div className="absolute top-2 left-2 bg-gold-600 text-white rounded-full p-0.5 shadow-sm">
                                                <CheckCircle size={14} />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                         ) : (
                             <div className="bg-white rounded-lg border border-stone-200">
                                 <table className="w-full text-sm text-left">
                                     <thead className="bg-stone-50 text-stone-500 font-medium border-b border-stone-200">
                                         <tr>
                                             <th className="p-3 w-10"></th>
                                             <th className="p-3">Name</th>
                                             <th className="p-3">Category</th>
                                             <th className="p-3">Date</th>
                                             <th className="p-3 w-20">Status</th>
                                             <th className="p-3 w-10"></th>
                                         </tr>
                                     </thead>
                                     <tbody>
                                         {filteredProducts.map(product => (
                                             <tr 
                                                key={product.id} 
                                                onClick={(e) => handleSelect(product.id, e.ctrlKey || e.metaKey || true)}
                                                onDoubleClick={() => setEditProduct(product)}
                                                className={`border-b border-stone-100 hover:bg-stone-50 cursor-pointer ${selectedIds.has(product.id) ? 'bg-gold-50' : ''}`}
                                             >
                                                 <td className="p-3">
                                                     <img src={product.images[0]} className="w-8 h-8 rounded object-cover bg-stone-200" />
                                                 </td>
                                                 <td className="p-3 font-medium text-stone-700">{product.title}</td>
                                                 <td className="p-3 text-stone-500">{product.category}</td>
                                                 <td className="p-3 text-stone-400 text-xs">{product.dateTaken}</td>
                                                 <td className="p-3">
                                                     {product.isHidden ? <Lock size={14} className="text-red-400"/> : <CheckCircle size={14} className="text-green-400"/>}
                                                 </td>
                                                 <td className="p-3 text-stone-400">
                                                     <button onClick={(e) => {e.stopPropagation(); setEditProduct(product);}} className="hover:text-gold-600"><Edit2 size={14}/></button>
                                                 </td>
                                             </tr>
                                         ))}
                                     </tbody>
                                 </table>
                             </div>
                         )
                     )}
                 </div>
             </div>
          </div>
      )}

      {/* ================= EDIT MODAL ================= */}
      {editProduct && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="p-4 border-b border-stone-100 flex justify-between items-center bg-stone-50">
                      <h3 className="font-serif text-lg font-bold text-stone-800">Edit Details</h3>
                      <button onClick={() => setEditProduct(null)} className="text-stone-400 hover:text-stone-600"><X size={20}/></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div className="flex justify-center mb-4">
                          <img src={editProduct.images[0]} className="h-32 w-32 object-cover rounded-xl shadow-md border border-stone-200" />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Title</label>
                          <input 
                              value={editProduct.title}
                              onChange={e => setEditProduct({...editProduct, title: e.target.value})}
                              className="w-full p-2 border border-stone-200 rounded-lg text-sm"
                          />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Category</label>
                              <select 
                                  value={editProduct.category}
                                  onChange={e => setEditProduct({...editProduct, category: e.target.value})}
                                  className="w-full p-2 border border-stone-200 rounded-lg text-sm bg-white"
                              >
                                  {folders.filter(f => f !== 'All' && f !== 'Private').map(f => <option key={f} value={f}>{f}</option>)}
                              </select>
                          </div>
                          <div>
                               <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Visibility</label>
                               <button 
                                  onClick={() => setEditProduct({...editProduct, isHidden: !editProduct.isHidden})}
                                  className={`w-full p-2 rounded-lg text-sm flex items-center justify-center gap-2 border ${
                                      editProduct.isHidden 
                                      ? 'bg-red-50 border-red-200 text-red-700' 
                                      : 'bg-green-50 border-green-200 text-green-700'
                                  }`}
                               >
                                   {editProduct.isHidden ? <Lock size={14}/> : <Unlock size={14}/>}
                                   {editProduct.isHidden ? 'Private' : 'Public'}
                               </button>
                          </div>
                      </div>
                  </div>
                  <div className="p-4 border-t border-stone-100 bg-stone-50 flex justify-end gap-2">
                      <button onClick={() => setEditProduct(null)} className="px-4 py-2 text-stone-500 hover:bg-stone-100 rounded-lg text-sm">Cancel</button>
                      <button onClick={handleSaveEdit} className="px-4 py-2 bg-stone-900 text-white rounded-lg text-sm flex items-center gap-2 hover:bg-stone-800">
                          <Save size={16} /> Save Changes
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* ================= MOVE TO CATEGORY MODAL ================= */}
      {showMoveModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="p-4 border-b border-stone-100 flex justify-between items-center bg-stone-50">
                      <h3 className="font-serif text-lg font-bold text-stone-800">Move Items</h3>
                      <button onClick={() => setShowMoveModal(false)} className="text-stone-400 hover:text-stone-600"><X size={20}/></button>
                  </div>
                  <div className="p-4">
                      <p className="text-sm text-stone-500 mb-3">Select a destination category for {selectedIds.size} item(s):</p>
                      <div className="space-y-1 max-h-60 overflow-y-auto">
                          {folders.filter(f => f !== 'All' && f !== 'Private').map(folder => (
                              <button
                                  key={folder}
                                  onClick={() => handleMoveSelected(folder)}
                                  className="w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-3 text-stone-700 hover:bg-gold-50 hover:text-gold-700"
                              >
                                  <Folder size={16} className="text-gold-400" />
                                  {folder}
                              </button>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};
