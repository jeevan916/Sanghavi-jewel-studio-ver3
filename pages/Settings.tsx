
import React, { useState, useEffect } from 'react';
import { storeService } from '../services/storeService';
import { AppConfig, Supplier, CategoryConfig, StaffAccount } from '../types';
import { Save, Plus, Trash2, Lock, Unlock, Settings as SettingsIcon, X, MessageCircle, Loader2, ArrowLeft, Users, Shield, UserPlus, Eye, EyeOff, Package, Tag, Layers, RefreshCw, Link as LinkIcon, HardDrive, Sparkles } from 'lucide-react';
import { Maintenance } from './Maintenance';

interface SettingsProps {
  onBack?: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onBack }) => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [activeTab, setActiveTab] = useState<'suppliers' | 'categories' | 'staff' | 'general' | 'maintenance'>('suppliers');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  
  const [staffList, setStaffList] = useState<StaffAccount[]>([]);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [newStaff, setNewStaff] = useState({ username: '', password: '', name: '', role: 'contributor' as const });
  const [showPassword, setShowPassword] = useState(false);

  const currentUser = storeService.getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';

  const [newSupplierName, setNewSupplierName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSubCategory, setNewSubCategory] = useState<{catId: string, val: string}>({catId: '', val: ''});

  useEffect(() => {
    const loadData = async () => {
        try {
            const data = await storeService.getConfig();
            setConfig(data);
            if (isAdmin) {
              const staff = await storeService.getStaff();
              setStaffList(staff);
            } else {
                if (['staff', 'general', 'maintenance'].includes(activeTab)) setActiveTab('suppliers');
            }
        } catch (e) {
            console.error("Failed to load settings data", e);
        } finally {
            setIsInitializing(false);
        }
    };
    loadData();
  }, [isAdmin]);

  const handleSave = async () => {
    if (config) {
        setIsLoading(true);
        await storeService.saveConfig(config);
        setIsLoading(false);
        alert('Settings Saved Successfully');
    }
  };

  if (activeTab === 'maintenance' && isAdmin) {
    return <Maintenance onBack={() => setActiveTab('suppliers')} />;
  }

  if (isInitializing || !config) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 p-6">
              <Loader2 className="animate-spin text-gold-600 mb-4" size={40} />
              <p className="text-stone-400 font-serif text-lg">Synchronizing Studio Prefs...</p>
          </div>
      );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 pb-24 animate-fade-in">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
            {onBack && (
                <button onClick={onBack} className="p-2 hover:bg-stone-100 rounded-full transition-colors text-stone-600">
                  <ArrowLeft size={24} />
                </button>
            )}
            <div>
                <h2 className="font-serif text-3xl text-gold-700">Studio Settings</h2>
                <p className="text-stone-500 text-sm">System configuration for {currentUser?.name}.</p>
            </div>
        </div>
        <button 
            onClick={handleSave}
            disabled={isLoading}
            className="px-6 py-2 bg-stone-900 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-stone-800 transition shadow-lg disabled:opacity-50"
        >
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Save Changes
        </button>
      </header>

      <div className="flex gap-2 md:gap-4 mb-6 border-b border-stone-200 overflow-x-auto whitespace-nowrap scrollbar-hide">
        <button onClick={() => setActiveTab('suppliers')} className={`pb-3 px-2 font-bold text-xs uppercase tracking-widest transition-colors ${activeTab === 'suppliers' ? 'text-gold-600 border-b-2 border-gold-600' : 'text-stone-400'}`}>Suppliers</button>
        <button onClick={() => setActiveTab('categories')} className={`pb-3 px-2 font-bold text-xs uppercase tracking-widest transition-colors ${activeTab === 'categories' ? 'text-gold-600 border-b-2 border-gold-600' : 'text-stone-400'}`}>Taxonomy</button>
        {isAdmin && <button onClick={() => setActiveTab('staff')} className={`pb-3 px-2 font-bold text-xs uppercase tracking-widest transition-colors ${activeTab === 'staff' ? 'text-gold-600 border-b-2 border-gold-600' : 'text-stone-400'}`}>Staff</button>}
        {isAdmin && <button onClick={() => setActiveTab('general')} className={`pb-3 px-2 font-bold text-xs uppercase tracking-widest transition-colors ${activeTab === 'general' ? 'text-gold-600 border-b-2 border-gold-600' : 'text-stone-400'}`}>General</button>}
        {isAdmin && <button onClick={() => setActiveTab('maintenance')} className={`pb-3 px-2 font-bold text-xs uppercase tracking-widest transition-colors ${activeTab === 'maintenance' ? 'text-gold-600 border-b-2 border-gold-600' : 'text-stone-400'}`}>Maintenance</button>}
      </div>

      {activeTab === 'suppliers' && (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white p-6 rounded-xl border border-stone-100 shadow-sm">
                <h3 className="font-bold text-stone-700 mb-4 flex items-center gap-2"><Package size={18}/> Manufacturing Sources</h3>
                <div className="flex gap-2 mb-6">
                    <input value={newSupplierName} onChange={e => setNewSupplierName(e.target.value)} placeholder="New supplier name..." className="flex-1 p-2 border border-stone-200 rounded-lg text-sm" />
                    <button onClick={() => {
                        if(!newSupplierName.trim() || !config) return;
                        const newSup: Supplier = { id: Date.now().toString(), name: newSupplierName, isPrivate: false };
                        setConfig({...config, suppliers: [...(config.suppliers || []), newSup]});
                        setNewSupplierName('');
                    }} className="bg-gold-600 text-white px-4 rounded-lg hover:bg-gold-700 transition"><Plus /></button>
                </div>
                <div className="space-y-2">
                    {(config.suppliers || []).map(s => (
                        <div key={s.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-lg border border-stone-100">
                             <div className="flex items-center gap-3">
                                 <span className="font-medium text-stone-700">{s.name}</span>
                                 {s.isPrivate && <span className="text-[9px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full uppercase font-bold">Locked</span>}
                             </div>
                             <div className="flex items-center gap-2">
                                 <button onClick={() => setConfig({...config, suppliers: (config.suppliers || []).map(sup => sup.id === s.id ? {...sup, isPrivate: !sup.isPrivate} : sup)})} className="p-2 text-stone-400 hover:text-stone-600 transition-colors">
                                     {s.isPrivate ? <Lock size={16}/> : <Unlock size={16}/>}
                                 </button>
                                 <button onClick={() => setConfig({...config, suppliers: (config.suppliers || []).filter(sup => sup.id !== s.id)})} className="p-2 text-stone-400 hover:text-red-500 transition-colors">
                                     <Trash2 size={16}/>
                                 </button>
                             </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}

      {activeTab === 'categories' && (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white p-6 rounded-xl border border-stone-100 shadow-sm">
                <h3 className="font-bold text-stone-700 mb-4 flex items-center gap-2"><Tag size={18}/> Collection Hierarchy</h3>
                <div className="flex gap-2 mb-6">
                    <input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="New category name..." className="flex-1 p-2 border border-stone-200 rounded-lg text-sm" />
                    <button onClick={() => {
                        if(!newCategoryName.trim() || !config) return;
                        const newCat: CategoryConfig = { id: Date.now().toString(), name: newCategoryName, subCategories: [], isPrivate: false };
                        setConfig({...config, categories: [...(config.categories || []), newCat]});
                        setNewCategoryName('');
                    }} className="bg-gold-600 text-white px-4 rounded-lg hover:bg-gold-700 transition"><Plus /></button>
                </div>

                <div className="space-y-4">
                    {(config.categories || []).map(c => (
                        <div key={c.id} className="border border-stone-200 rounded-xl overflow-hidden shadow-sm">
                            <div className="bg-stone-50 p-3 flex justify-between items-center border-b border-stone-200">
                                <span className="font-bold text-stone-700 flex items-center gap-2">{c.name} {c.isPrivate && <Lock size={12} className="text-red-400"/>}</span>
                                <div className="flex items-center gap-2">
                                    <button onClick={async () => {
                                        const link = await storeService.createSharedLink(c.name, 'category');
                                        navigator.clipboard.writeText(link);
                                        alert(`Secure link for "${c.name}" copied to clipboard!`);
                                    }} className="p-1.5 bg-white border border-stone-200 rounded hover:bg-gold-50 hover:border-gold-200 text-stone-500 hover:text-gold-600 transition">
                                        <LinkIcon size={14} />
                                    </button>
                                    <button onClick={() => setConfig({...config, categories: (config.categories || []).map(cat => cat.id === c.id ? {...cat, isPrivate: !cat.isPrivate} : cat)})} className="text-[10px] text-stone-400 hover:text-stone-600 uppercase font-bold tracking-widest ml-2">{c.isPrivate ? 'Make Public' : 'Make Private'}</button>
                                </div>
                            </div>
                            <div className="p-4 bg-white">
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {c.subCategories.map(sub => (
                                        <span key={sub} className="bg-stone-50 text-stone-600 px-2 py-1 rounded text-[10px] font-bold border border-stone-200 flex items-center gap-1">
                                            {sub.toUpperCase()}
                                            <button onClick={() => setConfig({...config, categories: (config.categories || []).map(cat => cat.id === c.id ? {...cat, subCategories: cat.subCategories.filter(s => s !== sub)} : cat)})} className="hover:text-red-500 transition-colors"><X size={10} /></button>
                                        </span>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <input value={newSubCategory.catId === c.id ? newSubCategory.val : ''} onChange={e => setNewSubCategory({catId: c.id, val: e.target.value})} placeholder={`Add sub-category...`} className="flex-1 text-sm p-1.5 border border-stone-200 rounded focus:border-gold-400 outline-none" />
                                    <button onClick={() => {
                                        if(!newSubCategory.val.trim() || newSubCategory.catId !== c.id || !config) return;
                                        setConfig({...config, categories: (config.categories || []).map(cat => cat.id === c.id ? {...cat, subCategories: [...cat.subCategories, newSubCategory.val]} : cat)});
                                        setNewSubCategory({catId: '', val: ''});
                                    }} className="text-[10px] font-bold uppercase bg-stone-800 text-white px-3 rounded hover:bg-stone-700">Add</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}

      {activeTab === 'staff' && isAdmin && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white p-6 rounded-xl border border-stone-100 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-stone-700 flex items-center gap-2"><Users size={20}/> Active Personnel</h3>
                    <button onClick={() => setShowAddStaff(true)} className="flex items-center gap-2 px-4 py-2 bg-gold-600 text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-gold-700 transition"><UserPlus size={16}/> Add Staff</button>
                </div>
                <div className="space-y-3">
                    {staffList.map(s => (
                        <div key={s.id} className={`p-4 rounded-xl border transition-all flex items-center justify-between ${s.isActive ? 'bg-white border-stone-100 shadow-sm' : 'bg-stone-50 border-stone-200 opacity-60'}`}>
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-full ${s.role === 'admin' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                                    <Shield size={20}/>
                                </div>
                                <div>
                                    <p className="font-bold text-stone-800 leading-none mb-1">{s.name}</p>
                                    <p className="text-[10px] text-stone-400 font-mono">@{s.username} • {s.role.toUpperCase()}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={async () => {
                                    const updated = await storeService.updateStaff(s.id, { isActive: !s.isActive });
                                    setStaffList(staffList.map(item => item.id === s.id ? updated : item));
                                }} className={`p-2 rounded-lg transition ${s.isActive ? 'text-green-500 hover:bg-green-50' : 'text-stone-400 hover:bg-stone-200'}`}>
                                    {s.isActive ? <Unlock size={18}/> : <Lock size={18}/>}
                                </button>
                                <button onClick={async () => {
                                    if (s.id === currentUser?.id) return alert("Cannot delete self.");
                                    if (window.confirm("Delete staff member?")) {
                                        await storeService.deleteStaff(s.id);
                                        setStaffList(staffList.filter(item => item.id !== s.id));
                                    }
                                }} className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition">
                                    <Trash2 size={18}/>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
          </div>
      )}

      {activeTab === 'general' && isAdmin && (
        <div className="space-y-6 animate-in fade-in duration-300">
             <div className="bg-white p-6 rounded-xl border border-stone-100 shadow-sm">
                <h3 className="font-bold text-stone-700 mb-4 flex items-center gap-2"><MessageCircle size={18}/> Communication</h3>
                <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">WhatsApp Number</label>
                    <input type="text" value={config.whatsappNumber || ''} onChange={e => setConfig({...config, whatsappNumber: e.target.value})} placeholder="91..." className="w-full p-2 border border-stone-200 rounded-lg text-sm" />
                </div>
            </div>
             <div className="bg-white p-6 rounded-xl border border-stone-100 shadow-sm">
                <h3 className="font-bold text-stone-700 mb-4 flex items-center gap-2"><Layers size={18}/> Persistence</h3>
                <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Link Expiry (Hours)</label>
                    <input type="number" value={config.linkExpiryHours} onChange={e => setConfig({...config, linkExpiryHours: parseInt(e.target.value) || 24})} className="w-full p-2 border border-stone-200 rounded-lg text-sm" />
                </div>
            </div>
        </div>
      )}

      {showAddStaff && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden animate-in zoom-in-95">
                  <div className="p-4 border-b flex justify-between items-center bg-stone-50">
                      <h3 className="font-bold text-stone-800">New Team Member</h3>
                      <button onClick={() => setShowAddStaff(false)}><X size={20}/></button>
                  </div>
                  <form onSubmit={async (e) => {
                      e.preventDefault();
                      const added = await storeService.addStaff({ ...newStaff, isActive: true });
                      setStaffList([...staffList, added]);
                      setShowAddStaff(false);
                      setNewStaff({ username: '', password: '', name: '', role: 'contributor' });
                  }} className="p-6 space-y-4">
                      <input required value={newStaff.name} onChange={e => setNewStaff({...newStaff, name: e.target.value})} placeholder="Full Name" className="w-full p-3 border rounded-xl" />
                      <input required value={newStaff.username} onChange={e => setNewStaff({...newStaff, username: e.target.value})} placeholder="Username" className="w-full p-3 border rounded-xl" />
                      <div className="relative">
                        <input required type={showPassword ? 'text' : 'password'} value={newStaff.password} onChange={e => setNewStaff({...newStaff, password: e.target.value})} placeholder="Password" className="w-full p-3 border rounded-xl" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400">{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
                      </div>
                      <select value={newStaff.role} onChange={e => setNewStaff({...newStaff, role: e.target.value as any})} className="w-full p-3 border rounded-xl">
                          <option value="contributor">Contributor</option>
                          <option value="admin">Administrator</option>
                      </select>
                      <button type="submit" className="w-full py-3 bg-stone-900 text-white rounded-xl font-bold shadow-lg">Create Account</button>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};
