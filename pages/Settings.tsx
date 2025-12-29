import React, { useState, useEffect } from 'react';
import { storeService } from '../services/storeService';
import { AppConfig, Supplier, CategoryConfig } from '../types';
import { Save, Plus, Trash2, Lock, Unlock, Settings as SettingsIcon, X, MessageCircle, Loader2, ArrowLeft } from 'lucide-react';

interface SettingsProps {
  onBack?: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onBack }) => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [activeTab, setActiveTab] = useState<'suppliers' | 'categories' | 'general'>('suppliers');
  
  // Temp states
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSubCategory, setNewSubCategory] = useState<{catId: string, val: string}>({catId: '', val: ''});

  useEffect(() => {
    storeService.getConfig().then(setConfig);
  }, []);

  const handleSave = async () => {
    if (config) {
        await storeService.saveConfig(config);
        alert('Settings Saved Successfully');
    }
  };

  // --- Supplier Logic ---
  const addSupplier = () => {
    if(!newSupplierName.trim() || !config) return;
    const newSup: Supplier = {
      id: Date.now().toString(),
      name: newSupplierName,
      isPrivate: false
    };
    setConfig({...config, suppliers: [...config.suppliers, newSup]});
    setNewSupplierName('');
  };

  const deleteSupplier = (id: string) => {
    if (!config) return;
    setConfig({...config, suppliers: config.suppliers.filter(s => s.id !== id)});
  };

  const toggleSupplierPrivacy = (id: string) => {
    if (!config) return;
    setConfig({
      ...config,
      suppliers: config.suppliers.map(s => s.id === id ? {...s, isPrivate: !s.isPrivate} : s)
    });
  };

  // --- Category Logic ---
  const addCategory = () => {
    if(!newCategoryName.trim() || !config) return;
    const newCat: CategoryConfig = {
      id: Date.now().toString(),
      name: newCategoryName,
      subCategories: [],
      isPrivate: false
    };
    setConfig({...config, categories: [...config.categories, newCat]});
    setNewCategoryName('');
  };

  const addSubCategory = (catId: string) => {
    if(!newSubCategory.val.trim() || newSubCategory.catId !== catId || !config) return;
    setConfig({
        ...config,
        categories: config.categories.map(c => 
            c.id === catId ? {...c, subCategories: [...c.subCategories, newSubCategory.val]} : c
        )
    });
    setNewSubCategory({catId: '', val: ''});
  };

  const removeSubCategory = (catId: string, sub: string) => {
    if (!config) return;
    setConfig({
        ...config,
        categories: config.categories.map(c => 
            c.id === catId ? {...c, subCategories: c.subCategories.filter(s => s !== sub)} : c
        )
    });
  };

  const toggleCategoryPrivacy = (id: string) => {
    if (!config) return;
    setConfig({
      ...config,
      categories: config.categories.map(c => c.id === id ? {...c, isPrivate: !c.isPrivate} : c)
    });
  };

  if (!config) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-gold-600"/></div>;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 pb-24 animate-fade-in">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
            {onBack && (
                <button 
                  onClick={onBack}
                  className="p-2 hover:bg-stone-100 rounded-full transition-colors text-stone-600"
                >
                  <ArrowLeft size={24} />
                </button>
            )}
            <div>
                <h2 className="font-serif text-3xl text-gold-700">Settings</h2>
                <p className="text-stone-500 text-sm">Manage suppliers, categories, and system config.</p>
            </div>
        </div>
        <button 
            onClick={handleSave}
            className="px-6 py-2 bg-stone-900 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-stone-800 transition shadow-lg"
        >
            <Save size={18} /> Save Changes
        </button>
      </header>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-stone-200">
        <button onClick={() => setActiveTab('suppliers')} className={`pb-3 px-2 font-medium text-sm transition-colors ${activeTab === 'suppliers' ? 'text-gold-600 border-b-2 border-gold-600' : 'text-stone-400'}`}>Suppliers</button>
        <button onClick={() => setActiveTab('categories')} className={`pb-3 px-2 font-medium text-sm transition-colors ${activeTab === 'categories' ? 'text-gold-600 border-b-2 border-gold-600' : 'text-stone-400'}`}>Categories</button>
        <button onClick={() => setActiveTab('general')} className={`pb-3 px-2 font-medium text-sm transition-colors ${activeTab === 'general' ? 'text-gold-600 border-b-2 border-gold-600' : 'text-stone-400'}`}>General</button>
      </div>

      {/* SUPPLIERS TAB */}
      {activeTab === 'suppliers' && (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-stone-100 shadow-sm">
                <h3 className="font-bold text-stone-700 mb-4">Manage Suppliers</h3>
                <div className="flex gap-2 mb-6">
                    <input 
                        value={newSupplierName}
                        onChange={e => setNewSupplierName(e.target.value)}
                        placeholder="Add new supplier name..."
                        className="flex-1 p-2 border border-stone-200 rounded-lg text-sm"
                    />
                    <button onClick={addSupplier} className="bg-gold-600 text-white px-4 rounded-lg hover:bg-gold-700 transition"><Plus /></button>
                </div>
                
                <div className="space-y-2">
                    {config.suppliers.map(s => (
                        <div key={s.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-lg border border-stone-100">
                             <div className="flex items-center gap-3">
                                 <span className="font-medium text-stone-700">{s.name}</span>
                                 {s.isPrivate && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full uppercase font-bold">Private</span>}
                             </div>
                             <div className="flex items-center gap-2">
                                 <button onClick={() => toggleSupplierPrivacy(s.id)} className="p-2 text-stone-400 hover:text-stone-600 transition-colors" title={s.isPrivate ? 'Unlock' : 'Lock'}>
                                     {s.isPrivate ? <Lock size={16}/> : <Unlock size={16}/>}
                                 </button>
                                 <button onClick={() => deleteSupplier(s.id)} className="p-2 text-stone-400 hover:text-red-500 transition-colors">
                                     <Trash2 size={16}/>
                                 </button>
                             </div>
                        </div>
                    ))}
                    {config.suppliers.length === 0 && <p className="text-center text-stone-400 text-sm py-4">No suppliers configured.</p>}
                </div>
            </div>
        </div>
      )}

      {/* CATEGORIES TAB */}
      {activeTab === 'categories' && (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-stone-100 shadow-sm">
                <h3 className="font-bold text-stone-700 mb-4">Manage Categories</h3>
                <div className="flex gap-2 mb-6">
                    <input 
                        value={newCategoryName}
                        onChange={e => setNewCategoryName(e.target.value)}
                        placeholder="New Category Name..."
                        className="flex-1 p-2 border border-stone-200 rounded-lg text-sm"
                    />
                    <button onClick={addCategory} className="bg-gold-600 text-white px-4 rounded-lg hover:bg-gold-700 transition"><Plus /></button>
                </div>

                <div className="space-y-4">
                    {config.categories.map(c => (
                        <div key={c.id} className="border border-stone-200 rounded-xl overflow-hidden">
                            <div className="bg-stone-50 p-3 flex justify-between items-center border-b border-stone-200">
                                <div className="flex items-center gap-3">
                                     <span className="font-bold text-stone-700">{c.name}</span>
                                     {c.isPrivate && <Lock size={14} className="text-red-400"/>}
                                </div>
                                <div className="flex gap-2">
                                     <button onClick={() => toggleCategoryPrivacy(c.id)} className="text-stone-400 hover:text-stone-600 text-xs uppercase font-bold transition-colors">
                                         {c.isPrivate ? 'Make Public' : 'Make Private'}
                                     </button>
                                </div>
                            </div>
                            <div className="p-4 bg-white">
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {c.subCategories.map(sub => (
                                        <span key={sub} className="bg-stone-100 text-stone-600 px-2 py-1 rounded text-xs flex items-center gap-1 border border-stone-200">
                                            {sub}
                                            <button onClick={() => removeSubCategory(c.id, sub)}><X size={12} className="hover:text-red-500"/></button>
                                        </span>
                                    ))}
                                    {c.subCategories.length === 0 && <span className="text-xs text-stone-400 italic">No sub-categories</span>}
                                </div>
                                <div className="flex gap-2">
                                    <input 
                                        value={newSubCategory.catId === c.id ? newSubCategory.val : ''}
                                        onChange={e => setNewSubCategory({catId: c.id, val: e.target.value})}
                                        placeholder={`Add ${c.name} sub-category...`}
                                        className="flex-1 text-sm p-1.5 border border-stone-200 rounded focus:border-gold-400 outline-none"
                                    />
                                    <button onClick={() => addSubCategory(c.id)} className="text-xs bg-stone-800 text-white px-3 rounded hover:bg-stone-700 transition">Add</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}

      {/* GENERAL TAB */}
      {activeTab === 'general' && (
        <div className="space-y-6">
             <div className="bg-white p-6 rounded-xl border border-stone-100 shadow-sm">
                <h3 className="font-bold text-stone-700 mb-4">Contact Configuration</h3>
                <div className="flex flex-col gap-4">
                    <div>
                        <label className="block text-sm font-medium text-stone-600 mb-2">Business WhatsApp Number</label>
                        <div className="relative">
                            <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                            <input 
                                type="text"
                                value={config.whatsappNumber || ''}
                                onChange={e => setConfig({...config, whatsappNumber: e.target.value})}
                                placeholder="e.g., 919876543210 (Include Country Code)"
                                className="w-full pl-10 pr-4 py-2 border border-stone-200 rounded-lg text-sm"
                            />
                        </div>
                        <p className="text-xs text-stone-400 mt-1">Inquiries will be directed to this number. Leave empty for contact selection.</p>
                    </div>
                </div>
            </div>

             <div className="bg-white p-6 rounded-xl border border-stone-100 shadow-sm">
                <h3 className="font-bold text-stone-700 mb-4">Privacy & Sharing</h3>
                <div className="flex flex-col gap-4">
                    <div>
                        <label className="block text-sm font-medium text-stone-600 mb-2">Secret Link Validity (Hours)</label>
                        <input 
                            type="number"
                            value={config.linkExpiryHours}
                            onChange={e => setConfig({...config, linkExpiryHours: parseInt(e.target.value) || 24})}
                            className="w-full p-2 border border-stone-200 rounded-lg text-sm"
                        />
                        <p className="text-xs text-stone-400 mt-1">Generated secret links will expire after this duration.</p>
                    </div>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};