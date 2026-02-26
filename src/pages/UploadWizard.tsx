
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Loader2, Save, X, Plus, Image as ImageIcon, Briefcase, Layers, CheckCircle, AlertCircle, Trash2, Smartphone, ImagePlus, ArrowRight, Tag as TagIcon, Eye, ChevronRight, Sparkles, Wand2 } from 'lucide-react';
import { analyzeJewelryImage } from '@/services/geminiService.ts';
import { storeService } from '@/services/storeService.ts';
import { Product, AppConfig } from '@/types.ts';
import { useUpload } from '@/contexts/UploadContext.tsx';

type UploadMode = 'single' | 'batch';

export const UploadWizard: React.FC = () => {
  const [mode, setMode] = useState<UploadMode>('single');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const currentUser = storeService.getCurrentUser();
  const [config, setConfig] = useState<AppConfig | null>(null);

  const { queue, addToQueue, removeFromQueue, clearCompleted, useAI, setUseAI, processImage } = useUpload();
  
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubCategory, setSelectedSubCategory] = useState('');
  
  const [step, setStep] = useState(1);
  const [images, setImages] = useState<string[]>([]); // Stores primary URL
  const [thumbnailUrl, setThumbnailUrl] = useState<string>(''); // Stores thumb URL
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [analysisData, setAnalysisData] = useState<Partial<Product>>({});

  useEffect(() => {
    storeService.getConfig().then(setConfig).catch(() => null);
  }, []);

  const getDeviceInfo = () => {
    const ua = navigator.userAgent;
    let device = "Desktop PC";
    let manufacturer = "Generic";
    if (/android/i.test(ua)) { device = "Android Phone"; }
    else if (/iPad|iPhone|iPod/.test(ua)) { device = "iOS Device"; manufacturer = "Apple"; }
    return { device, manufacturer };
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (mode === 'single') {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImages([ev.target?.result as string]);
        setStep(2);
      };
      reader.readAsDataURL(file);
    } else {
      const info = getDeviceInfo();
      addToQueue(Array.from(files), selectedSupplier, selectedCategory, selectedSubCategory, info.device, info.manufacturer);
      if (e.target) e.target.value = ''; 
    }
  };

  const handleProceedToDetails = async () => {
    if (images.length === 0) return;
    
    setIsAnalyzing(true);
    setUploadError(null);
    try {
      // Keep reference to original data URL for AI Analysis before overwriting with server URL
      const originalBase64 = images[0];

      // Upload to Backend Engine
      const { primary, thumbnail } = await processImage(originalBase64, { enhance: false });
      setImages([primary]);
      setThumbnailUrl(thumbnail);

      if (useAI) {
        // Use original base64 for Gemini Metadata Analysis
        const base64Clean = originalBase64.includes(',') ? originalBase64.split(',')[1] : originalBase64;
        const result = await analyzeJewelryImage(base64Clean);
        setAnalysisData((prev: Partial<Product>) => ({
          ...prev,
          ...result,
          category: selectedCategory || result.category,
          subCategory: selectedSubCategory || result.subCategory,
        }));
      }
      setStep(3);
    } catch (error: any) {
      setUploadError(`Analysis/Processing failed: ${error.message}`);
      setStep(3);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSingleSave = async () => {
    setIsSaving(true);
    try {
      // Images are already uploaded in handleProceedToDetails
      const finalMain = images[0];
      const finalThumb = thumbnailUrl || finalMain;

      const newProduct: Product = {
        id: Date.now().toString(),
        title: analysisData.title || `SJ-${Date.now().toString().slice(-6)}`,
        category: selectedCategory || analysisData.category || 'Other',
        subCategory: selectedSubCategory || analysisData.subCategory,
        weight: analysisData.weight || 0,
        description: analysisData.description || '',
        tags: analysisData.tags || [],
        images: [finalMain],
        thumbnails: [finalThumb], 
        supplier: selectedSupplier,
        uploadedBy: currentUser?.name || 'Staff',
        isHidden: false,
        createdAt: new Date().toISOString(),
        dateTaken: analysisData.dateTaken || new Date().toISOString().split('T')[0],
        meta: { 
            cameraModel: getDeviceInfo().device, 
            deviceManufacturer: getDeviceInfo().manufacturer,
            makingChargeSegmentId: analysisData.meta?.makingChargeSegmentId,
            otherCharges: analysisData.meta?.otherCharges
        }
      };
      await storeService.addProduct(newProduct);
      alert("Jewelry Assets Secured in Vault!");
      setStep(1); setImages([]); setThumbnailUrl(''); setAnalysisData({}); setSelectedCategory(''); setUploadError(null);
    } catch (err: any) {
      setUploadError(`Storage failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const activeSubCategories = config?.categories?.find((c: any) => c.name === selectedCategory)?.subCategories || [];

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 pb-24 animate-fade-in text-brand-dark">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="font-sans font-bold text-3xl text-brand-dark uppercase tracking-tight">Studio Vault Upload</h2>
          <p className="text-stone-400 text-sm font-serif italic">Secure your physical media assets with AI intelligence.</p>
        </div>
        <div className="flex bg-stone-50 p-1 rounded-xl border border-stone-100">
            <button onClick={() => setMode('single')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all uppercase tracking-tighter ${mode === 'single' ? 'bg-white shadow-sm text-brand-red' : 'text-stone-400'}`}>Wizard</button>
            <button onClick={() => setMode('batch')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 uppercase tracking-tighter ${mode === 'batch' ? 'bg-white shadow-sm text-brand-red' : 'text-stone-400'}`}><Layers size={14} /> Batch</button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-stone-100 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2">
            <Briefcase size={12} /> Identification
          </h4>
          <div className="flex items-center gap-3">
             <span className={`text-[9px] font-bold uppercase tracking-widest transition-colors ${useAI ? 'text-gold-600' : 'text-stone-300'}`}>
               {useAI ? 'Neural Engine Active' : 'Neural Engine Off'}
             </span>
             <button 
                onClick={() => setUseAI(!useAI)} 
                className={`w-10 h-5 rounded-full relative transition-colors duration-300 ${useAI ? 'bg-gold-500' : 'bg-stone-200'}`}
             >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-300 ${useAI ? 'left-5.5' : 'left-0.5'}`} />
             </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="block text-[9px] font-bold text-stone-400 uppercase ml-1">Supplier</label>
            <select value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)} className="w-full p-2 bg-stone-50 border border-stone-100 rounded-lg text-xs font-medium text-stone-700 focus:ring-1 focus:ring-gold-500 outline-none appearance-none cursor-pointer">
              <option value="">Select Source...</option>
              {config?.suppliers?.map((s: any) => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-[9px] font-bold text-stone-400 uppercase ml-1">Category</label>
            <select value={selectedCategory} onChange={e => { setSelectedCategory(e.target.value); setSelectedSubCategory(''); }} className="w-full p-2 bg-stone-50 border border-stone-100 rounded-lg text-xs font-medium text-stone-700 focus:ring-1 focus:ring-gold-500 outline-none appearance-none cursor-pointer">
              <option value="">Select Category...</option>
              {config?.categories?.map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-[9px] font-bold text-stone-400 uppercase ml-1">Sub-Category</label>
            <select value={selectedSubCategory} onChange={e => setSelectedSubCategory(e.target.value)} disabled={!selectedCategory} className="w-full p-2 bg-stone-50 border border-stone-100 rounded-lg text-xs font-medium text-stone-700 focus:ring-1 focus:ring-gold-500 outline-none disabled:opacity-50 appearance-none cursor-pointer">
              <option value="">Select Sub...</option>
              {activeSubCategories.map((sub: string) => <option key={sub} value={sub}>{sub}</option>)}
            </select>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {mode === 'batch' ? (
          <motion.div 
            key="batch"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="flex gap-4">
                <button onClick={() => fileInputRef.current?.click()} className="flex-1 px-4 py-4 bg-stone-900 text-white rounded-xl font-bold shadow-lg hover:bg-stone-800 flex items-center justify-center gap-2 transition-all uppercase tracking-widest text-[10px]"><ImagePlus size={16} /> Library</button>
                <button onClick={() => cameraInputRef.current?.click()} className="flex-1 px-4 py-4 bg-gold-600 text-white rounded-xl font-bold shadow-lg hover:bg-gold-700 flex items-center justify-center gap-2 transition-all uppercase tracking-widest text-[10px]"><Camera size={16} /> Camera</button>
            </div>
            
            <AnimatePresence>
                {queue.length > 0 && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="bg-white rounded-2xl border border-stone-100 overflow-hidden shadow-sm"
                    >
                        <div className="p-3 bg-stone-50 border-b border-stone-100 flex justify-between items-center">
                          <div className="flex items-center gap-2">
                             <Layers size={14} className="text-stone-400" />
                             <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">Queue: {queue.length} Assets</span>
                          </div>
                          <div className="flex items-center gap-3">
                              <button onClick={clearCompleted} className="text-[9px] font-bold uppercase text-stone-400 hover:text-gold-600 transition-colors">Clear Done</button>
                              <div className="w-px h-3 bg-stone-200" />
                              <button onClick={() => { if(confirm('Clear entire queue?')) queue.forEach(i => removeFromQueue(i.id)); }} className="text-[9px] font-bold uppercase text-red-400 hover:text-red-600 transition-colors">Clear All</button>
                          </div>
                        </div>
                        <div className="divide-y divide-stone-50 max-h-[350px] overflow-y-auto scrollbar-hide">
                            {queue.map(item => (
                                <div key={item.id} className="p-3 flex items-center gap-4 group hover:bg-stone-50/50 transition-colors">
                                    <div className="relative">
                                        <img src={item.previewUrl} className="w-10 h-10 object-cover rounded-lg border border-stone-100 shadow-sm" />
                                        {item.status === 'complete' && (
                                            <div className="absolute -top-1 -right-1 bg-green-500 text-white rounded-full p-0.5 shadow-sm">
                                                <CheckCircle size={10} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[11px] font-bold truncate text-stone-700">{item.file.name}</p>
                                      <div className="flex items-center gap-2">
                                          <span className={`text-[8px] uppercase font-bold tracking-widest ${
                                              item.status === 'complete' ? 'text-green-500' : 
                                              item.status === 'error' ? 'text-red-400' : 
                                              item.status === 'pending' ? 'text-stone-300' : 'text-gold-500 animate-pulse'
                                          }`}>
                                              {item.status}
                                          </span>
                                          {item.productTitle && <span className="text-[8px] text-stone-400 truncate max-w-[120px]">→ {item.productTitle}</span>}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {item.status === 'error' && <AlertCircle size={14} className="text-red-400" />}
                                        <button 
                                            onClick={() => removeFromQueue(item.id)} 
                                            className="p-2 text-stone-200 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 size={14}/>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*" multiple />
            <input type="file" ref={cameraInputRef} onChange={handleFileSelect} className="hidden" accept="image/*" capture="environment" />
          </motion.div>
        ) : (
          <motion.div
            key="single"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            <AnimatePresence mode="wait">
              {step === 1 && (
                  <motion.div 
                    key="step1"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    onClick={() => cameraInputRef.current?.click()} 
                    className="border-2 border-dashed border-gold-500/30 rounded-3xl p-16 flex flex-col items-center justify-center bg-gold-50/30 cursor-pointer hover:bg-gold-50/50 transition h-80 shadow-inner group"
                  >
                      <div className="p-4 bg-white rounded-full shadow-md mb-4 border border-gold-100 group-hover:scale-110 transition-transform">
                        <Camera size={48} className="text-gold-600" />
                      </div>
                      <p className="font-sans font-bold text-2xl text-stone-800 uppercase tracking-tight">Launch Studio Camera</p>
                      <div className="mt-8 flex gap-4">
                        <button onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }} className="px-6 py-2 bg-white text-stone-400 border border-stone-100 rounded-xl text-[10px] font-bold uppercase shadow-sm hover:shadow-md hover:text-gold-600 transition flex items-center gap-2">
                          <ImageIcon size={14} /> Open Gallery
                        </button>
                      </div>
                      <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*" />
                      <input type="file" ref={cameraInputRef} onChange={handleFileSelect} className="hidden" accept="image/*" capture="environment" />
                  </motion.div>
              )}
              {step === 2 && (
                  <motion.div 
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                      <div className="bg-white p-4 rounded-2xl border border-stone-100 shadow-sm">
                        <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Eye size={14}/> Selected Assets</h4>
                        <div className="grid grid-cols-2 gap-4">
                            {images.map((img: string, idx: number) => (
                              <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border border-stone-100 group">
                                <img src={img} className="w-full h-full object-cover" />
                                <button onClick={() => { setImages([]); setStep(1); }} className="absolute inset-0 bg-stone-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                  <Trash2 size={24} className="text-white"/>
                                </button>
                              </div>
                            ))}
                        </div>
                      </div>
                      <button onClick={handleProceedToDetails} disabled={isAnalyzing} className="w-full py-4 bg-gold-600 text-white rounded-2xl font-bold shadow-xl flex items-center justify-center gap-3 disabled:opacity-50 transition-all uppercase tracking-widest text-xs">
                        {isAnalyzing ? <Loader2 className="animate-spin" /> : <ArrowRight size={18} />}
                        {isAnalyzing ? 'Analyzing with Neural Engine...' : 'Proceed to Details'}
                      </button>
                  </motion.div>
              )}
              {step === 3 && (
                  <motion.div 
                    key="step3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                      <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-100 space-y-6">
                          <div className="space-y-4">
                            <div>
                              <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1.5 ml-1">Asset Title</label>
                              <input value={analysisData.title || ''} onChange={e => setAnalysisData({...analysisData, title: e.target.value})} className="w-full p-4 bg-stone-50 border border-stone-100 rounded-xl font-sans font-bold text-2xl text-stone-800 focus:border-gold-500 outline-none transition-colors" placeholder="E.g. Vintage Emerald Choker" />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1.5 ml-1">Description</label>
                              <textarea value={analysisData.description || ''} onChange={e => setAnalysisData({...analysisData, description: e.target.value})} className="w-full p-4 bg-stone-50 border border-stone-100 rounded-xl text-sm min-h-[140px] focus:border-gold-500 outline-none transition-colors font-serif italic" placeholder="Describe the jewelry craftsmanship..." />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-[10px] font-bold text-stone-400 uppercase mb-1 ml-1">Weight (g)</label><input type="number" step="0.01" value={analysisData.weight || ''} onChange={e => setAnalysisData({...analysisData, weight: parseFloat(e.target.value)})} className="w-full p-4 bg-stone-50 border border-stone-100 rounded-xl focus:ring-1 focus:ring-gold-500 outline-none" placeholder="0.00" /></div>
                                <div><label className="block text-[10px] font-bold text-stone-400 uppercase mb-1 ml-1">Date</label><input type="date" value={analysisData.dateTaken || ''} onChange={e => setAnalysisData({...analysisData, dateTaken: e.target.value})} className="w-full p-4 bg-stone-50 border border-stone-100 rounded-xl focus:ring-1 focus:ring-gold-500 outline-none" /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1 ml-1">Making Segment</label>
                                  <select 
                                      value={analysisData.meta?.makingChargeSegmentId || ''} 
                                      onChange={e => setAnalysisData({...analysisData, meta: {...(analysisData.meta || {}), makingChargeSegmentId: e.target.value}})} 
                                      className="w-full p-4 bg-stone-50 border border-stone-100 rounded-xl focus:ring-1 focus:ring-gold-500 outline-none text-xs font-bold uppercase tracking-widest"
                                  >
                                      <option value="">Default ({config?.makingChargeSegments.find((s: any) => s.id === config.defaultMakingChargeSegmentId)?.name || '12%'})</option>
                                      {config?.makingChargeSegments.map((s: any) => (
                                          <option key={s.id} value={s.id}>{s.name} ({s.percent}%)</option>
                                      ))}
                                  </select>
                                </div>
                                <div><label className="block text-[10px] font-bold text-stone-400 uppercase mb-1 ml-1">Other Charges (₹)</label><input type="number" value={analysisData.meta?.otherCharges || ''} onChange={e => setAnalysisData({...analysisData, meta: {...(analysisData.meta || {}), otherCharges: parseFloat(e.target.value)}})} className="w-full p-4 bg-stone-50 border border-stone-100 rounded-xl focus:ring-1 focus:ring-gold-500 outline-none" placeholder="0" /></div>
                            </div>
                          </div>
                      </div>
                      <div className="flex gap-4">
                        <button onClick={() => setStep(2)} className="px-6 py-4 bg-stone-50 text-stone-400 rounded-2xl font-bold uppercase tracking-widest text-[10px] border border-stone-100">Back</button>
                        <button onClick={handleSingleSave} disabled={isSaving} className="flex-1 py-4 bg-stone-900 text-white rounded-2xl font-bold shadow-xl flex items-center justify-center gap-3 disabled:opacity-50 hover:bg-stone-800 transition-colors uppercase tracking-widest text-xs">
                          {isSaving ? <Loader2 className="animate-spin" /> : <Save size={18} />} 
                          {isSaving ? 'Saving...' : 'Commit to Vault'}
                        </button>
                      </div>
                  </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
      {uploadError && <div className="mt-6 p-4 bg-brand-red/10 border border-brand-red/20 rounded-2xl flex items-start gap-3"><AlertCircle className="text-brand-red mt-0.5" size={18} /><p className="text-sm text-brand-red">{uploadError}</p></div>}
    </div>
  );
};
