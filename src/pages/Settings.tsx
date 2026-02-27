
import React, { useState, useEffect } from 'react';
import { storeService } from '../services/storeService';
import { AppConfig, Supplier, CategoryConfig, StaffAccount, PromptTemplate } from '../types';
import { Save, Plus, Trash2, Lock, Unlock, Settings as SettingsIcon, X, MessageCircle, Loader2, ArrowLeft, Users, Shield, UserPlus, Eye, EyeOff, Package, Tag, Layers, RefreshCw, Link as LinkIcon, HardDrive, Sparkles, BrainCircuit, FilePlus, ChevronDown, FileText, Edit2 } from 'lucide-react';
import { Maintenance } from './Maintenance';

interface SettingsProps {
  onBack?: () => void;
}

// Sub-component for managing a single AI Prompt Section
const PromptSection = ({
    title,
    modelValue,
    promptValue,
    templates,
    modelOptions,
    onModelChange,
    onPromptChange,
    onSaveTemplate,
    onDeleteTemplate
}: {
    title: string;
    modelValue: string;
    promptValue: string;
    templates: PromptTemplate[];
    modelOptions: {id: string, label: string}[];
    onModelChange: (val: string) => void;
    onPromptChange: (val: string) => void;
    onSaveTemplate: (label: string, content: string) => void;
    onDeleteTemplate: (id: string) => void;
}) => {
    const [isSaving, setIsSaving] = useState(false);
    const [newLabel, setNewLabel] = useState('');

    return (
        <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm transition-all hover:shadow-md">
            {/* Header Area */}
            <div className="p-4 bg-stone-50/50 border-b border-stone-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-gold-100/50 text-gold-700 rounded-lg">
                        <Sparkles size={16} />
                    </div>
                    <label className="text-xs font-bold text-stone-600 uppercase tracking-widest">{title}</label>
                </div>
                <div className="relative w-full sm:w-auto">
                    <select 
                        value={modelValue} 
                        onChange={e => onModelChange(e.target.value)}
                        className="w-full sm:w-64 text-xs font-medium bg-white border border-stone-200 rounded-lg py-2 pl-3 pr-8 text-stone-700 focus:ring-1 focus:ring-gold-500 outline-none appearance-none cursor-pointer hover:border-gold-300 transition-colors"
                    >
                        {modelOptions.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none"/>
                </div>
            </div>

            {/* Editor Area */}
            <div className="p-4 space-y-4">
                <div className="relative">
                    <textarea 
                        value={promptValue}
                        onChange={e => onPromptChange(e.target.value)}
                        placeholder="Enter system prompt instructions for the AI..."
                        className="w-full h-32 p-4 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono text-stone-800 leading-relaxed focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 outline-none resize-y transition-all"
                    />
                    <div className="absolute bottom-3 right-3">
                        <button 
                            onClick={() => setIsSaving(true)} 
                            className="bg-white/90 backdrop-blur shadow-sm border border-stone-200 text-stone-500 hover:text-gold-600 hover:border-gold-300 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all"
                            title="Save as Preset"
                        >
                            <Save size={12}/> Save Preset
                        </button>
                    </div>
                </div>

                {/* Templates Manager */}
                <div className="space-y-3">
                    {isSaving ? (
                        <div className="flex items-center gap-2 p-3 bg-gold-50/50 border border-gold-100 rounded-xl animate-in fade-in slide-in-from-top-2">
                            <input 
                                value={newLabel}
                                onChange={e => setNewLabel(e.target.value)}
                                placeholder="Name your preset (e.g. 'Warm Studio Lighting')"
                                className="flex-1 bg-white border border-gold-200 rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-gold-500"
                                autoFocus
                            />
                            <button 
                                onClick={() => {
                                    if (newLabel.trim()) {
                                        onSaveTemplate(newLabel, promptValue);
                                        setIsSaving(false);
                                        setNewLabel('');
                                    }
                                }}
                                disabled={!newLabel.trim()}
                                className="bg-gold-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-gold-700 transition disabled:opacity-50"
                            >
                                Save
                            </button>
                            <button 
                                onClick={() => setIsSaving(false)}
                                className="p-2 text-stone-400 hover:text-stone-600"
                            >
                                <X size={16}/>
                            </button>
                        </div>
                    ) : (
                        <div>
                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <FilePlus size={12}/> Saved Templates ({templates.length})
                            </p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
                                {templates.map(t => (
                                    <div 
                                        key={t.id} 
                                        onClick={() => onPromptChange(t.content)}
                                        className="group relative flex flex-col gap-2 p-3 bg-stone-50 border border-stone-200 rounded-xl hover:bg-white hover:border-gold-400 hover:shadow-sm cursor-pointer transition-all h-full"
                                    >
                                        <div className="flex justify-between items-center pb-2 border-b border-stone-200/50">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <FileText size={12} className="text-stone-400 group-hover:text-gold-500 transition-colors shrink-0"/>
                                                <span className="text-xs font-bold text-stone-700 group-hover:text-gold-700 truncate">{t.label}</span>
                                            </div>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); if(confirm('Delete this template?')) onDeleteTemplate(t.id); }}
                                                className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 size={12}/>
                                            </button>
                                        </div>
                                        
                                        <div className="flex-1 bg-white rounded border border-stone-100 p-2 overflow-hidden">
                                            <p className="text-[9px] text-stone-500 font-mono leading-relaxed line-clamp-3">
                                                {t.content}
                                            </p>
                                        </div>
                                        
                                        <div className="text-[9px] font-bold text-gold-600 uppercase tracking-widest text-center pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            Apply Template
                                        </div>
                                    </div>
                                ))}
                                
                                {templates.length === 0 && (
                                    <div className="col-span-full px-4 py-6 border-2 border-dashed border-stone-100 rounded-xl flex flex-col items-center justify-center text-stone-400 gap-2">
                                        <Sparkles size={20} className="opacity-20" />
                                        <p className="text-xs">No saved templates found.</p>
                                        <button onClick={() => setIsSaving(true)} className="text-[10px] font-bold uppercase text-gold-600 hover:underline">
                                            Save current prompt as first template
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export const Settings: React.FC<SettingsProps> = ({ onBack }) => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [activeTab, setActiveTab] = useState<'suppliers' | 'categories' | 'staff' | 'general' | 'ai' | 'maintenance'>('suppliers');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  
  const [staffList, setStaffList] = useState<StaffAccount[]>([]);
  
  // Unified Staff Modal State
  const [staffModal, setStaffModal] = useState<{
    isOpen: boolean;
    mode: 'add' | 'edit';
    id?: string;
    name: string;
    username: string;
    password: string;
    role: 'admin' | 'contributor';
  }>({ isOpen: false, mode: 'add', name: '', username: '', password: '', role: 'contributor' });

  const [showPassword, setShowPassword] = useState(false);

  const currentUser = storeService.getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';

  const [newSupplierName, setNewSupplierName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSubCategory, setNewSubCategory] = useState<{catId: string, val: string}>({catId: '', val: ''});

  const textModelOptions = [
      { id: 'gemini-flash-latest', label: 'Gemini Flash (Optimized for JSON)' },
      { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (Fastest Text)' },
      { id: 'gemini-3.1-pro-preview', label: 'Gemini 3 Pro (Complex Reasoning)' }
  ];

  const imageModelOptions = [
      { id: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image (Fastest Vision)' },
      { id: 'gemini-3-pro-image-preview', label: 'Gemini 3 Pro Image (High Res)' }
  ];

  useEffect(() => {
    const loadData = async () => {
        try {
            const data = await storeService.getConfig();
            setConfig(data);
            if (isAdmin) {
              const staff = await storeService.getStaff();
              setStaffList(staff);
            } else {
                if (['staff', 'general', 'maintenance', 'ai'].includes(activeTab)) setActiveTab('suppliers');
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

  // --- STAFF MANAGEMENT HANDLERS ---
  const openAddStaff = () => {
    setStaffModal({ isOpen: true, mode: 'add', name: '', username: '', password: '', role: 'contributor' });
  };

  const openEditStaff = (s: StaffAccount) => {
    setStaffModal({ 
        isOpen: true, 
        mode: 'edit', 
        id: s.id, 
        name: s.name, 
        username: s.username, 
        password: '', // Empty means no change
        role: s.role 
    });
  };

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
        if (staffModal.mode === 'add') {
            const added = await storeService.addStaff({
                name: staffModal.name,
                username: staffModal.username,
                password: staffModal.password,
                role: staffModal.role,
                isActive: true
            });
            setStaffList([...staffList, added]);
        } else {
            const updates: any = {
                name: staffModal.name,
                username: staffModal.username,
                role: staffModal.role
            };
            if (staffModal.password) updates.password = staffModal.password;
            
            await storeService.updateStaff(staffModal.id!, updates);
            // Re-fetch list to ensure sync or update locally
            const updatedList = staffList.map(s => s.id === staffModal.id ? { ...s, ...updates } : s);
            setStaffList(updatedList);
        }
        setStaffModal({ ...staffModal, isOpen: false });
    } catch (err) {
        alert("Operation failed. Username might be taken.");
    } finally {
        setIsLoading(false);
    }
  };

  // --- CONFIG HANDLERS ---
  const updateAIModel = (key: 'analysis' | 'enhancement' | 'watermark' | 'design', value: string) => {
      if (!config) return;
      setConfig({
          ...config,
          aiConfig: {
              ...config.aiConfig,
              models: { ...config.aiConfig.models, [key]: value }
          }
      });
  };

  const updateAIPrompt = (key: 'analysis' | 'enhancement' | 'watermark' | 'design', value: string) => {
      if (!config) return;
      setConfig({
          ...config,
          aiConfig: {
              ...config.aiConfig,
              prompts: { ...config.aiConfig.prompts, [key]: value }
          }
      });
  };

  const addTemplate = (key: 'analysis' | 'enhancement' | 'watermark' | 'design', label: string, content: string) => {
      if (!config) return;
      const newTemplate: PromptTemplate = { id: Date.now().toString(), label, content };
      const templates = config.aiConfig.templates || { analysis: [], enhancement: [], watermark: [], design: [] };
      const currentTemplates = templates[key] || [];
      
      setConfig({
          ...config,
          aiConfig: {
              ...config.aiConfig,
              templates: {
                  ...templates,
                  [key]: [...currentTemplates, newTemplate]
              }
          }
      });
  };

  const deleteTemplate = (key: 'analysis' | 'enhancement' | 'watermark' | 'design', id: string) => {
      if (!config) return;
      const templates = config.aiConfig.templates || { analysis: [], enhancement: [], watermark: [], design: [] };
      const currentTemplates = templates[key] || [];
      
      setConfig({
          ...config,
          aiConfig: {
              ...config.aiConfig,
              templates: {
                  ...templates,
                  [key]: currentTemplates.filter((t: PromptTemplate) => t.id !== id)
              }
          }
      });
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
        {isAdmin && <button onClick={() => setActiveTab('ai')} className={`pb-3 px-2 font-bold text-xs uppercase tracking-widest transition-colors ${activeTab === 'ai' ? 'text-gold-600 border-b-2 border-gold-600' : 'text-stone-400'}`}>Neural Engine</button>}
        {isAdmin && <button onClick={() => setActiveTab('staff')} className={`pb-3 px-2 font-bold text-xs uppercase tracking-widest transition-colors ${activeTab === 'staff' ? 'text-gold-600 border-b-2 border-gold-600' : 'text-stone-400'}`}>Staff</button>}
        {isAdmin && <button onClick={() => setActiveTab('general')} className={`pb-3 px-2 font-bold text-xs uppercase tracking-widest transition-colors ${activeTab === 'general' ? 'text-gold-600 border-b-2 border-gold-600' : 'text-stone-400'}`}>General</button>}
        {isAdmin && <button onClick={() => setActiveTab('maintenance')} className={`pb-3 px-2 font-bold text-xs uppercase tracking-widest transition-colors ${activeTab === 'maintenance' ? 'text-gold-600 border-b-2 border-gold-600' : 'text-stone-400'}`}>Maintenance</button>}
      </div>

      {activeTab === 'suppliers' && (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white p-6 rounded-xl border border-stone-100 shadow-sm">
                <h3 className="font-bold text-stone-700 mb-4 flex items-center gap-2"><Package size={18}/> Manufacturing Sources</h3>
                <div className="flex gap-2 mb-6">
                    <input value={newSupplierName} onChange={e => setNewSupplierName(e.target.value)} placeholder="New supplier name..." className="flex-1 p-2 border border-stone-200 rounded-lg text-sm text-stone-900" />
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
                    <input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="New category name..." className="flex-1 p-2 border border-stone-200 rounded-lg text-sm text-stone-900" />
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
                                    <input value={newSubCategory.catId === c.id ? newSubCategory.val : ''} onChange={e => setNewSubCategory({catId: c.id, val: e.target.value})} placeholder={`Add sub-category...`} className="flex-1 text-sm p-1.5 border border-stone-200 rounded focus:border-gold-400 outline-none text-stone-900" />
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

      {activeTab === 'ai' && isAdmin && (
          <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-white p-6 rounded-xl border border-stone-100 shadow-sm">
                  <h3 className="font-bold text-stone-700 mb-6 flex items-center gap-2">
                      <BrainCircuit size={20} className="text-gold-600"/> Neural Configuration
                  </h3>
                  
                  <div className="space-y-8">
                      {/* Analysis Settings */}
                      <PromptSection 
                          title="Metadata Analysis Engine"
                          modelValue={config.aiConfig?.models.analysis || ''}
                          promptValue={config.aiConfig?.prompts.analysis || ''}
                          templates={config.aiConfig?.templates?.analysis || []}
                          modelOptions={textModelOptions}
                          onModelChange={v => updateAIModel('analysis', v)}
                          onPromptChange={v => updateAIPrompt('analysis', v)}
                          onSaveTemplate={(l, c) => addTemplate('analysis', l, c)}
                          onDeleteTemplate={id => deleteTemplate('analysis', id)}
                      />

                      {/* Enhancement Settings */}
                      <PromptSection 
                          title="Image Enhancement Engine"
                          modelValue={config.aiConfig?.models.enhancement || ''}
                          promptValue={config.aiConfig?.prompts.enhancement || ''}
                          templates={config.aiConfig?.templates?.enhancement || []}
                          modelOptions={imageModelOptions}
                          onModelChange={v => updateAIModel('enhancement', v)}
                          onPromptChange={v => updateAIPrompt('enhancement', v)}
                          onSaveTemplate={(l, c) => addTemplate('enhancement', l, c)}
                          onDeleteTemplate={id => deleteTemplate('enhancement', id)}
                      />

                       {/* Watermark Settings */}
                       <PromptSection 
                          title="Watermark Removal Engine"
                          modelValue={config.aiConfig?.models.watermark || ''}
                          promptValue={config.aiConfig?.prompts.watermark || ''}
                          templates={config.aiConfig?.templates?.watermark || []}
                          modelOptions={imageModelOptions}
                          onModelChange={v => updateAIModel('watermark', v)}
                          onPromptChange={v => updateAIPrompt('watermark', v)}
                          onSaveTemplate={(l, c) => addTemplate('watermark', l, c)}
                          onDeleteTemplate={id => deleteTemplate('watermark', id)}
                      />

                      {/* Design Generation Settings */}
                      <div className="space-y-2">
                          <p className="text-[10px] text-stone-400 pl-1">Use {'${prompt}'} placeholder for user input.</p>
                          <PromptSection 
                              title="Design Generation Engine"
                              modelValue={config.aiConfig?.models.design || ''}
                              promptValue={config.aiConfig?.prompts.design || ''}
                              templates={config.aiConfig?.templates?.design || []}
                              modelOptions={imageModelOptions}
                              onModelChange={v => updateAIModel('design', v)}
                              onPromptChange={v => updateAIPrompt('design', v)}
                              onSaveTemplate={(l, c) => addTemplate('design', l, c)}
                              onDeleteTemplate={id => deleteTemplate('design', id)}
                          />
                      </div>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'staff' && isAdmin && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white p-6 rounded-xl border border-stone-100 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-stone-700 flex items-center gap-2"><Users size={20}/> Active Personnel</h3>
                    <button onClick={openAddStaff} className="flex items-center gap-2 px-4 py-2 bg-gold-600 text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-gold-700 transition"><UserPlus size={16}/> Add Staff</button>
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
                                <button onClick={() => openEditStaff(s)} className="p-2 text-stone-400 hover:text-gold-600 hover:bg-gold-50 rounded-lg transition-colors" title="Edit / Reset Password">
                                    <Edit2 size={18} />
                                </button>
                                <button onClick={async () => {
                                    const updated = await storeService.updateStaff(s.id, { isActive: !s.isActive });
                                    setStaffList(staffList.map(item => item.id === s.id ? { ...item, isActive: !item.isActive } : item)); // Optimistic local update as updateStaff returns status
                                }} className={`p-2 rounded-lg transition ${s.isActive ? 'text-green-500 hover:bg-green-50' : 'text-stone-400 hover:bg-stone-200'}`} title={s.isActive ? "Lock Account" : "Unlock Account"}>
                                    {s.isActive ? <Unlock size={18}/> : <Lock size={18}/>}
                                </button>
                                <button onClick={async () => {
                                    if (s.id === currentUser?.id) return alert("Cannot delete self.");
                                    if (window.confirm("Delete staff member? This cannot be undone.")) {
                                        await storeService.deleteStaff(s.id);
                                        setStaffList(staffList.filter(item => item.id !== s.id));
                                    }
                                }} className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition" title="Delete Account">
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
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">WhatsApp Number (For Inquiries)</label>
                        <input type="text" value={config.whatsappNumber || ''} onChange={e => setConfig({...config, whatsappNumber: e.target.value})} placeholder="91..." className="w-full p-2 border border-stone-200 rounded-lg text-sm text-stone-900" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">WhatsApp Phone ID (For OTP)</label>
                            <input type="text" value={config.whatsappPhoneId || ''} onChange={e => setConfig({...config, whatsappPhoneId: e.target.value})} placeholder="Enter Phone ID from Meta Dashboard" className="w-full p-2 border border-stone-200 rounded-lg text-sm text-stone-900" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">WhatsApp Template Name</label>
                            <input type="text" value={config.whatsappTemplateName || ''} onChange={e => setConfig({...config, whatsappTemplateName: e.target.value})} placeholder="e.g. sanghavi_jewel_studio" className="w-full p-2 border border-stone-200 rounded-lg text-sm text-stone-900" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">WhatsApp Access Token</label>
                        <div className="relative">
                            <input 
                                type={showPassword ? 'text' : 'password'} 
                                value={config.whatsappToken || ''} 
                                onChange={e => setConfig({...config, whatsappToken: e.target.value})} 
                                placeholder="Enter Permanent Access Token" 
                                className="w-full p-2 border border-stone-200 rounded-lg text-sm text-stone-900 pr-10" 
                            />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                                {showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
             <div className="bg-white p-6 rounded-xl border border-stone-100 shadow-sm">
                <h3 className="font-bold text-stone-700 mb-4 flex items-center gap-2"><Layers size={18}/> Persistence</h3>
                <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Link Expiry (Hours)</label>
                    <input type="number" value={config.linkExpiryHours} onChange={e => setConfig({...config, linkExpiryHours: parseInt(e.target.value) || 24})} className="w-full p-2 border border-stone-200 rounded-lg text-sm text-stone-900" />
                </div>
            </div>
        </div>
      )}

      {staffModal.isOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden animate-in zoom-in-95">
                  <div className="p-4 border-b flex justify-between items-center bg-stone-50">
                      <h3 className="font-bold text-stone-800">
                        {staffModal.mode === 'add' ? 'New Team Member' : 'Edit Staff Profile'}
                      </h3>
                      <button onClick={() => setStaffModal({...staffModal, isOpen: false})}><X size={20}/></button>
                  </div>
                  <form onSubmit={handleStaffSubmit} className="p-6 space-y-4">
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Full Name</label>
                          <input required value={staffModal.name} onChange={e => setStaffModal({...staffModal, name: e.target.value})} placeholder="Full Name" className="w-full p-3 border rounded-xl text-stone-900 focus:ring-2 focus:ring-gold-500/20 outline-none" />
                      </div>
                      
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Username</label>
                          <input required value={staffModal.username} onChange={e => setStaffModal({...staffModal, username: e.target.value})} placeholder="Username" className="w-full p-3 border rounded-xl text-stone-900 focus:ring-2 focus:ring-gold-500/20 outline-none" />
                      </div>
                      
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">
                             {staffModal.mode === 'add' ? 'Password' : 'Reset Password (Optional)'}
                          </label>
                          <div className="relative">
                            <input 
                                required={staffModal.mode === 'add'} 
                                type={showPassword ? 'text' : 'password'} 
                                value={staffModal.password} 
                                onChange={e => setStaffModal({...staffModal, password: e.target.value})} 
                                placeholder={staffModal.mode === 'add' ? "Secret Key" : "Leave blank to keep current"} 
                                className="w-full p-3 border rounded-xl text-stone-900 focus:ring-2 focus:ring-gold-500/20 outline-none" 
                            />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                                {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                            </button>
                          </div>
                      </div>

                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Access Role</label>
                          <select value={staffModal.role} onChange={e => setStaffModal({...staffModal, role: e.target.value as any})} className="w-full p-3 border rounded-xl text-stone-900 focus:ring-2 focus:ring-gold-500/20 outline-none">
                              <option value="contributor">Contributor (Standard)</option>
                              <option value="admin">Administrator (Full Access)</option>
                          </select>
                      </div>

                      <button type="submit" disabled={isLoading} className="w-full py-3 bg-stone-900 text-white rounded-xl font-bold shadow-lg hover:bg-stone-800 transition flex items-center justify-center gap-2">
                          {isLoading ? <Loader2 className="animate-spin" size={18} /> : (staffModal.mode === 'add' ? <Plus size={18}/> : <Save size={18}/>)}
                          {staffModal.mode === 'add' ? 'Create Account' : 'Save Changes'}
                      </button>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};
