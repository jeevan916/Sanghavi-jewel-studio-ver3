
import React, { useState, useRef, useEffect } from 'react';
import { Camera, Loader2, Save, X, RefreshCw, Plus, Image as ImageIcon, Calendar, Smartphone, User, Briefcase, Layers, CheckCircle, AlertCircle, Trash2, Zap, Eraser, Edit3, Sparkles, Wand2, Cpu, Eye, ImagePlus, ArrowRight, Tag } from 'lucide-react';
import { analyzeJewelryImage, enhanceJewelryImage } from '../services/geminiService';
import { storeService } from '../services/storeService';
import { Product, AppConfig, CategoryConfig } from '../types';
import { useUpload } from '../contexts/UploadContext';

type UploadMode = 'single' | 'batch';

export const UploadWizard: React.FC = () => {
  const [mode, setMode] = useState<UploadMode>('single');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const currentUser = storeService.getCurrentUser();
  const [config, setConfig] = useState<AppConfig | null>(null);

  const { queue, addToQueue, removeFromQueue, updateQueueItem, clearCompleted, isProcessing, useAI, setUseAI } = useUpload();
  
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubCategory, setSelectedSubCategory] = useState('');
  
  const [step, setStep] = useState(1);
  const [images, setImages] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [analysisData, setAnalysisData] = useState<Partial<Product>>({});

  useEffect(() => {
    storeService.getConfig().then(setConfig);
  }, []);

  const getDeviceInfo = () => {
    const ua = navigator.userAgent;
    let device = "Desktop PC";
    let manufacturer = "Generic";
    if (/android/i.test(ua)) { device = "Android Phone"; }
    else if (/iPad|iPhone|iPod/.test(ua)) { device = "iOS Device"; manufacturer = "Apple"; }
    return { device, manufacturer };
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (mode === 'single') {
      const newImages: string[] = [];
      let processed = 0;
      (Array.from(files) as File[]).forEach((file: File) => {
        fileToBase64(file).then(base64 => {
            newImages.push(base64);
            processed++;
            if (processed === files.length) {
                setImages(prev => [...prev, ...newImages]);
                if (step === 1) setStep(2);
            }
        });
      });
    } else {
      const info = getDeviceInfo();
      addToQueue(Array.from(files), selectedSupplier, selectedCategory, selectedSubCategory, info.device, info.manufacturer);
      if (e.target) e.target.value = ''; 
    }
  };

  const handleProceedToDetails = async () => {
    if (images.length === 0) return;
    
    if (useAI) {
      setIsAnalyzing(true);
      setUploadError(null);
      try {
        const base64 = images[0].split(',')[1];
        const result = await analyzeJewelryImage(base64);
        setAnalysisData(prev => ({
          ...prev,
          ...result,
          category: selectedCategory || result.category,
          subCategory: selectedSubCategory || result.subCategory,
        }));
        setStep(3);
      } catch (error: any) {
        setUploadError(`AI analysis failed: ${error.message}`);
        // Still proceed but without AI data
        setStep(3);
      } finally {
        setIsAnalyzing(false);
      }
    } else {
      setStep(3);
    }
  };

  const handleSingleSave = async () => {
    setIsSaving(true);
    try {
      const newProduct: Product = {
        id: Date.now().toString(),
        title: analysisData.title || `SJ-${Date.now().toString().slice(-6)}`,
        category: selectedCategory || analysisData.category || 'Other',
        subCategory: selectedSubCategory || analysisData.subCategory,
        weight: analysisData.weight || 0,
        description: analysisData.description || '',
        tags: analysisData.tags || [],
        images: images,
        thumbnails: images, 
        supplier: selectedSupplier,
        uploadedBy: currentUser?.name || 'Staff',
        isHidden: false,
        createdAt: new Date().toISOString(),
        dateTaken: analysisData.dateTaken || new Date().toISOString().split('T')[0],
        meta: { 
            cameraModel: getDeviceInfo().device, 
            deviceManufacturer: getDeviceInfo().manufacturer 
        }
      };
      await storeService.addProduct(newProduct);
      alert("Jewelry Assets Secured in Physical Storage!");
      setStep(1); setImages([]); setAnalysisData({}); setSelectedCategory(''); setUploadError(null);
    } catch (err: any) {
      setUploadError(`Storage failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Critical fix: Optional chaining to prevent find() crash on undefined categories
  const activeSubCategories = config?.categories?.find(c => c.name === selectedCategory)?.subCategories || [];

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 pb-24 animate-fade-in text-stone-800">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="font-serif text-3xl text-gold-700">Studio Vault Upload</h2>
          <p className="text-stone-500 text-sm">Secure your physical media assets with AI intelligence.</p>
        </div>
        <div className="flex bg-stone-100 p-1 rounded-xl">
            <button onClick={() => setMode('single')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'single' ? 'bg-white shadow text-stone-900' : 'text-stone-500'}`}>Wizard</button>
            <button onClick={() => setMode('batch')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${mode === 'batch' ? 'bg-white shadow text-stone-900' : 'text-stone-500'}`}><Layers size={14} /> Batch</button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm mb-6 space-y-6">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2">
            <Briefcase size={14} /> Batch Identification
          </h4>
          <div className="flex items-center gap-3">
             <span className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${useAI ? 'text-gold-600' : 'text-stone-400'}`}>
               {useAI ? 'AI Analysis Active' : 'AI Analysis Disabled'}
             </span>
             <button 
               onClick={() => setUseAI(!useAI)}
               className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${useAI ? 'bg-gold-500' : 'bg-stone-300'}`}
             >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 ${useAI ? 'left-7' : 'left-1'}`} />
             </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">Supplier</label><select value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)} className="w-full p-2 border border-stone-200 rounded-lg text-sm bg-stone-50"><option value="">Select...</option>{config?.suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</select></div>
          <div><label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">Category</label><select value={selectedCategory} onChange={e => { setSelectedCategory(e.target.value); setSelectedSubCategory(''); }} className="w-full p-2 border border-stone-200 rounded-lg text-sm bg-stone-50"><option value="">Select...</option>{config?.categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
          <div><label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">Sub-Category</label><select value={selectedSubCategory} onChange={e => setSelectedSubCategory(e.target.value)} disabled={!selectedCategory} className="w-full p-2 border border-stone-200 rounded-lg text-sm bg-stone-50"><option value="">Select...</option>{activeSubCategories.map(sub => <option key={sub} value={sub}>{sub}</option>)}</select></div>
        </div>
      </div>

      {mode === 'batch' ? (
        <div className="space-y-6">
            <div className="flex gap-4">
                <button onClick={() => fileInputRef.current?.click()} className="flex-1 px-4 py-5 bg-stone-900 text-white rounded-2xl font-bold shadow hover:bg-stone-800 flex items-center justify-center gap-2 transition-all"><ImagePlus size={20} /> Select Library</button>
                <button onClick={() => cameraInputRef.current?.click()} className="flex-1 px-4 py-5 bg-gold-600 text-white rounded-2xl font-bold shadow hover:bg-gold-700 flex items-center justify-center gap-2 transition-all"><Camera size={20} /> Launch Camera</button>
            </div>
            {queue.length > 0 && (
                <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
                    <div className="p-4 bg-stone-50 border-b border-stone-200 text-[10px] font-bold text-stone-400 uppercase flex justify-between items-center">
                      <span className="flex items-center gap-2"><ImageIcon size={14}/> Queue: {queue.length} Assets</span>
                      <button onClick={clearCompleted} className="text-red-400 hover:text-red-600 transition-colors">Clear Completed</button>
                    </div>
                    <div className="divide-y divide-stone-100 max-h-[400px] overflow-y-auto">
                        {queue.map(item => (
                            <div key={item.id} className="p-4 flex items-center gap-4">
                                <img src={item.previewUrl} className="w-12 h-12 object-cover rounded-lg border border-stone-100" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold truncate">{item.file.name}</p>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[9px] uppercase font-bold tracking-widest ${item.status === 'complete' ? 'text-green-500' : 'text-stone-400'}`}>
                                      {item.status}
                                    </span>
                                    {item.status === 'analyzing' && <Loader2 size={8} className="animate-spin text-gold-500" />}
                                  </div>
                                </div>
                                {item.status === 'complete' ? (
                                  <div className="bg-green-100 text-green-600 p-1 rounded-full"><CheckCircle size={16} /></div>
                                ) : (
                                  <button onClick={() => removeFromQueue(item.id)} className="text-stone-300 hover:text-red-400 transition-colors"><Trash2 size={16}/></button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*" multiple />
            <input type="file" ref={cameraInputRef} onChange={handleFileSelect} className="hidden" accept="image/*" capture="environment" />
        </div>
      ) : (
        <>
            {step === 1 && (
                <div onClick={() => cameraInputRef.current?.click()} className="border-2 border-dashed border-gold-300 rounded-3xl p-16 flex flex-col items-center justify-center bg-gold-50/50 cursor-pointer hover:bg-gold-50 transition h-80 group shadow-inner">
                    <div className="p-4 bg-white rounded-full shadow-md group-hover:scale-110 transition-transform mb-4 border border-gold-100">
                      <Camera size={48} className="text-gold-500" />
                    </div>
                    <p className="font-serif text-2xl text-gold-800">Launch Native Studio Camera</p>
                    <p className="text-stone-400 text-sm mt-1">Directly launch system app for maximum resolution</p>
                    <div className="mt-8 flex gap-4">
                      <button onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }} className="px-6 py-2 bg-white text-stone-600 border border-stone-200 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow hover:shadow-md transition flex items-center gap-2">
                        <ImageIcon size={14} /> Open Gallery
                      </button>
                    </div>
                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*" multiple />
                    <input type="file" ref={cameraInputRef} onChange={handleFileSelect} className="hidden" accept="image/*" capture="environment" />
                </div>
            )}
            {step === 2 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                    <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
                      <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Eye size={14}/> Selected Media Assets</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {images.map((img, idx) => (
                            <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden shadow-sm border border-stone-100 group">
                              <img src={img} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <button onClick={() => { setImages(prev => prev.filter((_, i) => i !== idx)); if(images.length <= 1) setStep(1); }} className="bg-red-500 text-white p-2 rounded-full shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform">
                                  <Trash2 size={16}/>
                                </button>
                              </div>
                            </div>
                          ))}
                          <button onClick={() => cameraInputRef.current?.click()} className="aspect-square rounded-2xl border-2 border-dashed border-stone-200 flex flex-col items-center justify-center text-stone-400 hover:bg-stone-50 hover:border-gold-300 transition-all">
                            <Plus size={24}/>
                            <span className="text-[10px] font-bold uppercase mt-1">Add More</span>
                          </button>
                      </div>
                    </div>
                    
                    <button 
                      onClick={handleProceedToDetails} 
                      disabled={isAnalyzing} 
                      className="w-full py-4 bg-gold-600 text-white rounded-2xl font-bold shadow-xl flex items-center justify-center gap-3 hover:bg-gold-700 transition-all active:scale-[0.98]"
                    >
                      {isAnalyzing ? <Loader2 className="animate-spin" /> : (useAI ? <Sparkles size={18} /> : <ArrowRight size={18} />)}
                      {isAnalyzing ? 'Analyzing with Gemini 3.0...' : (useAI ? 'AI Analysis & Proceed' : 'Proceed to Details')}
                    </button>
                    
                    <button onClick={() => { setImages([]); setStep(1); }} className="w-full py-2 text-stone-400 text-xs font-bold uppercase tracking-widest hover:text-red-400 transition-colors">Cancel Upload</button>
                </div>
            )}
            {step === 3 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200 space-y-6">
                        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                            {images.map((img, idx) => (
                              <div key={idx} className="w-20 h-20 shrink-0 rounded-xl overflow-hidden border border-stone-100 shadow-sm">
                                <img src={img} className="w-full h-full object-cover" />
                              </div>
                            ))}
                        </div>
                        
                        <div className="space-y-4">
                          <div>
                            <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1.5 ml-1">Asset Title</label>
                            <input 
                              value={analysisData.title || ''} 
                              onChange={e => setAnalysisData({...analysisData, title: e.target.value})} 
                              className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl font-serif text-2xl focus:border-gold-500 outline-none transition-all" 
                              placeholder="E.g. Vintage Emerald Choker" 
                            />
                          </div>
                          
                          <div>
                            <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1.5 ml-1">Description & Marketing Copy</label>
                            <textarea 
                              value={analysisData.description || ''} 
                              onChange={(e) => setAnalysisData({...analysisData, description: e.target.value})} 
                              className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl text-sm min-h-[140px] focus:border-gold-500 outline-none transition-all" 
                              placeholder="Describe the jewelry craftsmanship..." 
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1 ml-1">Asset Weight (g)</label>
                                <input type="number" step="0.01" value={analysisData.weight || ''} onChange={e => setAnalysisData({...analysisData, weight: parseFloat(e.target.value)})} className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl focus:border-gold-500 outline-none" placeholder="0.00" />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1 ml-1">Date Logged</label>
                                <input type="date" value={analysisData.dateTaken || ''} onChange={e => setAnalysisData({...analysisData, dateTaken: e.target.value})} className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl focus:border-gold-500 outline-none" />
                              </div>
                          </div>
                          
                          {analysisData.tags && analysisData.tags.length > 0 && (
                            <div>
                               <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1.5 ml-1">Smart Tags</label>
                               <div className="flex flex-wrap gap-2">
                                 {analysisData.tags.map(tag => (
                                   <span key={tag} className="px-3 py-1 bg-gold-50 text-gold-700 text-[10px] font-bold rounded-full border border-gold-100 flex items-center gap-1">
                                     <Tag size={10} /> {tag}
                                   </span>
                                 ))}
                               </div>
                            </div>
                          )}
                        </div>
                    </div>
                    
                    <div className="flex gap-4">
                      <button onClick={() => setStep(2)} className="px-6 py-4 bg-stone-100 text-stone-500 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-stone-200 transition-colors">Back</button>
                      <button 
                        onClick={handleSingleSave} 
                        disabled={isSaving} 
                        className="flex-1 py-4 bg-stone-900 text-white rounded-2xl font-bold shadow-xl flex items-center justify-center gap-3 hover:bg-black transition-all active:scale-[0.98]"
                      >
                        {isSaving ? <Loader2 className="animate-spin" /> : <Save size={18} />} 
                        {isSaving ? 'Committing to Vault...' : 'Confirm & Commit to Storage'}
                      </button>
                    </div>
                </div>
            )}
        </>
      )}
      
      {uploadError && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 animate-in fade-in">
           <AlertCircle className="text-red-500 mt-0.5 shrink-0" size={18} />
           <div className="flex-1">
             <p className="text-xs font-bold text-red-800 uppercase tracking-widest">Upload Exception</p>
             <p className="text-sm text-red-700 mt-1">{uploadError}</p>
           </div>
           <button onClick={() => setUploadError(null)} className="text-red-400 hover:text-red-600"><X size={16}/></button>
        </div>
      )}
    </div>
  );
};
