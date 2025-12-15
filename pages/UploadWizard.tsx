import React, { useState, useRef, useEffect } from 'react';
import { Camera, Loader2, Save, X, RefreshCw, Plus, Image as ImageIcon, Calendar, Smartphone, User, Briefcase, Layers, CheckCircle, AlertCircle, Trash2, Zap, Eraser } from 'lucide-react';
import { analyzeJewelryImage } from '../services/geminiService';
import { storeService } from '../services/storeService';
import { Product } from '../types';
import { useUpload } from '../contexts/UploadContext';

type UploadMode = 'single' | 'batch';

export const UploadWizard: React.FC = () => {
  const [mode, setMode] = useState<UploadMode>('single');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const currentUser = storeService.getCurrentUser();
  
  // Consuming Global Context for Batch
  const { queue, addToQueue, removeFromQueue, clearCompleted, isProcessing, useAI, setUseAI, cleanImage } = useUpload();
  
  // Local state for Batch Inputs
  const [batchSupplier, setBatchSupplier] = useState('');
  
  // --- SINGLE MODE STATE ---
  const [step, setStep] = useState(1);
  const [images, setImages] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisData, setAnalysisData] = useState<Partial<Product>>({});

  // --- COMMON HELPERS ---
  const getDeviceName = () => {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) return "Android Mobile";
    if (/iPad|iPhone|iPod/.test(ua)) return "iOS Device";
    if (/Mac/i.test(ua)) return "Macintosh";
    if (/Win/i.test(ua)) return "Windows PC";
    return "Unknown Camera/Device";
  };

  const getTodayDate = () => new Date().toISOString().split('T')[0];

  // --- EFFECT: Single Mode Defaults ---
  useEffect(() => {
    if (step === 3 && !analysisData.dateTaken) {
       setAnalysisData(prev => ({
           ...prev,
           dateTaken: getTodayDate(),
           meta: { ...prev.meta, cameraModel: getDeviceName() },
           uploadedBy: currentUser?.name || 'Unknown',
       }));
    }
  }, [step, currentUser, analysisData.dateTaken]);

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
      (Array.from(files) as File[]).forEach((file) => {
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
      // Batch Mode: Add to global queue
      addToQueue(Array.from(files) as File[], batchSupplier, getDeviceName());
      if (e.target) e.target.value = ''; // Reset input
    }
  };

  const handleSingleAnalyze = async () => {
    if (images.length === 0) return;
    setIsAnalyzing(true);
    try {
      const base64 = images[0].split(',')[1];
      const result = await analyzeJewelryImage(base64);
      setAnalysisData(prev => ({
        ...prev,
        ...result
      }));
      setStep(3);
    } catch (error) {
      alert("Analysis failed. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSingleSave = () => {
    if (!analysisData.title) return;
    const newProduct: Product = {
      id: Date.now().toString(),
      title: analysisData.title || 'Untitled',
      category: analysisData.category || 'Other',
      subCategory: analysisData.subCategory,
      weight: analysisData.weight || 0,
      description: analysisData.description || '',
      tags: analysisData.tags || [],
      images: images,
      supplier: analysisData.supplier,
      uploadedBy: analysisData.uploadedBy,
      isHidden: false,
      createdAt: new Date().toISOString(),
      dateTaken: analysisData.dateTaken,
      meta: { 
          cameraModel: analysisData.meta?.cameraModel || 'Unknown', 
          location: analysisData.meta?.location 
      }
    };
    storeService.addProduct(newProduct);
    alert("Product saved!");
    setStep(1);
    setImages([]);
    setAnalysisData({});
  };

  // --- RENDER ---

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 pb-24 animate-fade-in">
      
      {/* Header & Mode Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
           <h2 className="font-serif text-3xl text-gold-700">Studio Upload</h2>
           <p className="text-stone-500 text-sm">Add to your digital collection.</p>
        </div>
        <div className="flex bg-stone-100 p-1 rounded-xl self-start">
            <button 
                onClick={() => setMode('single')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'single' ? 'bg-white shadow text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}
            >
                Detailed Wizard
            </button>
            <button 
                onClick={() => setMode('batch')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${mode === 'batch' ? 'bg-white shadow text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}
            >
                <Layers size={14} /> Batch Upload
            </button>
        </div>
      </div>

      {/* --- BATCH MODE UI --- */}
      {mode === 'batch' && (
        <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex gap-3">
                <Briefcase className="text-blue-600 shrink-0 mt-0.5" size={20} />
                <div>
                    <h4 className="text-blue-900 font-bold text-sm">Background Processing Active</h4>
                    <p className="text-blue-700 text-sm mt-1">
                        Images are processed in the background. Use the toggle below to control AI usage.
                    </p>
                </div>
            </div>

            {/* AI Toggle */}
            <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${useAI ? 'bg-gold-100 text-gold-600' : 'bg-stone-100 text-stone-400'}`}>
                        <Zap size={20} fill={useAI ? "currentColor" : "none"} />
                    </div>
                    <div>
                        <p className="font-bold text-stone-800 text-sm">Smart Analysis</p>
                        <p className="text-xs text-stone-500">
                            {useAI ? 'AI will tag and categorize images (Slower).' : 'Fast upload. No tagging (Immediate).'}
                        </p>
                    </div>
                </div>
                <button 
                    onClick={() => setUseAI(!useAI)}
                    className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${useAI ? 'bg-gold-500' : 'bg-stone-300'}`}
                >
                    <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform duration-300 ${useAI ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
            </div>

            {/* Batch Config & Inputs */}
            <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="w-full">
                        <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Default Supplier</label>
                        <input 
                            value={batchSupplier}
                            onChange={(e) => setBatchSupplier(e.target.value)}
                            placeholder="e.g. Default Supplier"
                            className="w-full p-2 border border-stone-200 rounded-lg text-sm"
                        />
                    </div>
                     <div className="w-full">
                        <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Device Info</label>
                        <input 
                            value={getDeviceName()}
                            disabled
                            className="w-full p-2 border border-stone-200 bg-stone-50 rounded-lg text-sm text-stone-400"
                        />
                    </div>
                </div>
                
                <div className="flex gap-2">
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 px-4 py-3 bg-stone-900 text-white rounded-lg font-medium shadow hover:bg-stone-800 transition flex items-center justify-center gap-2"
                    >
                        <Plus size={18} /> Select Photos
                    </button>
                    <button 
                        onClick={() => cameraInputRef.current?.click()}
                        className="flex-1 px-4 py-3 bg-gold-600 text-white rounded-lg font-medium shadow hover:bg-gold-700 transition flex items-center justify-center gap-2"
                    >
                        <Camera size={18} /> Camera
                    </button>
                </div>
            </div>

            {/* Global Queue List */}
            {queue.length > 0 && (
                <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                    <div className="p-3 bg-stone-50 border-b border-stone-200 text-xs font-bold text-stone-500 uppercase flex justify-between items-center">
                        <span>Upload Queue ({queue.filter(i => i.status === 'complete').length}/{queue.length})</span>
                        <div className="flex gap-2 items-center">
                            {isProcessing && <span className="flex items-center gap-1 text-gold-600 text-[10px]"><Loader2 size={10} className="animate-spin"/> Processing...</span>}
                            {queue.some(i => i.status === 'complete') && (
                                <button onClick={clearCompleted} className="text-stone-400 hover:text-red-500 flex items-center gap-1">
                                    <Trash2 size={12} /> Clear Done
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="divide-y divide-stone-100 max-h-[500px] overflow-y-auto">
                        {queue.map(item => (
                            <div key={item.id} className="p-3 flex items-center gap-4 hover:bg-stone-50 transition relative group">
                                <img src={item.previewUrl} className="w-12 h-12 object-cover rounded-lg bg-stone-200" alt="Preview" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-stone-800 truncate">{item.productTitle || item.file.name}</p>
                                    <p className="text-xs text-stone-400 flex items-center gap-2">
                                        <span>{(item.file.size / 1024 / 1024).toFixed(2)} MB</span>
                                        <span className={`uppercase font-bold text-[10px] ${
                                            item.status === 'complete' ? 'text-green-600' : 
                                            item.status === 'error' ? 'text-red-600' : 'text-blue-600'
                                        }`}>{item.status}</span>
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* Action: Remove Watermark (Only if pending) */}
                                    {item.status === 'pending' && (
                                        <button 
                                            onClick={() => cleanImage(item.id)}
                                            title="Clean Watermark/Text"
                                            className="p-1.5 bg-stone-100 text-stone-500 rounded hover:bg-purple-100 hover:text-purple-600 transition"
                                        >
                                            <Eraser size={14} />
                                        </button>
                                    )}

                                    {item.status === 'pending' && <span className="w-3 h-3 block rounded-full bg-stone-300" />}
                                    {item.status === 'analyzing' && <Loader2 size={18} className="text-gold-500 animate-spin" />}
                                    {item.status === 'saving' && <Loader2 size={18} className="text-blue-500 animate-spin" />}
                                    {item.status === 'complete' && <CheckCircle size={20} className="text-green-500" />}
                                    {item.status === 'error' && <AlertCircle size={20} className="text-red-500" />}
                                    
                                    {(item.status === 'pending' || item.status === 'complete' || item.status === 'error') && (
                                        <button 
                                            onClick={() => removeFromQueue(item.id)}
                                            className="p-1 hover:bg-red-50 rounded text-stone-300 hover:text-red-500 transition"
                                        >
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
             
             {/* Hidden Inputs */}
             <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*" multiple />
             <input type="file" ref={cameraInputRef} onChange={handleFileSelect} className="hidden" accept="image/*" capture="environment" />
        </div>
      )}

      {/* --- SINGLE MODE UI --- */}
      {mode === 'single' && (
        <>
            {/* STEP 1: UPLOAD */}
            {step === 1 && (
                <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gold-300 rounded-2xl p-12 flex flex-col items-center justify-center bg-gold-50 cursor-pointer hover:bg-gold-100 transition h-96 group"
                >
                <div className="p-4 bg-white rounded-full shadow-sm group-hover:scale-110 transition-transform mb-4">
                    <Camera size={48} className="text-gold-500" />
                </div>
                <p className="font-serif text-xl text-gold-800">Tap to Capture or Upload</p>
                <p className="text-stone-500 mt-2 text-sm text-center">Support for multiple angles (Multi-select)</p>
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*" multiple />
                </div>
            )}

            {/* STEP 2: PREVIEW */}
            {step === 2 && (
                <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {images.map((img, idx) => (
                        <div key={idx} className="relative aspect-square rounded-xl overflow-hidden shadow-sm border border-stone-200 group">
                            <img src={img} alt={`Angle ${idx + 1}`} className="w-full h-full object-cover" />
                            <button 
                                onClick={() => {
                                    setImages(prev => prev.filter((_, i) => i !== idx));
                                    if(images.length <= 1) setStep(1);
                                }}
                                className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition"
                            >
                                <X size={14} />
                            </button>
                            {idx === 0 && <span className="absolute bottom-2 left-2 bg-gold-500 text-white text-[10px] px-2 py-0.5 rounded shadow-sm">Main</span>}
                        </div>
                    ))}
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-square rounded-xl border-2 border-dashed border-stone-300 flex flex-col items-center justify-center text-stone-400 cursor-pointer hover:bg-stone-50 transition"
                    >
                        <Plus size={24} />
                        <span className="text-xs mt-1">Add More</span>
                    </div>
                </div>
                
                <div className="flex gap-4">
                    <button onClick={() => { setImages([]); setStep(1); }} className="flex-1 py-3 border border-stone-300 rounded-xl text-stone-600 font-medium hover:bg-stone-50">Reset</button>
                    <button 
                        onClick={handleSingleAnalyze}
                        disabled={isAnalyzing}
                        className="flex-[2] py-3 bg-gold-600 text-white rounded-xl font-medium shadow-lg shadow-gold-200 flex items-center justify-center gap-2 hover:bg-gold-700 transition"
                    >
                        {isAnalyzing ? <Loader2 className="animate-spin" /> : <Layers />}
                        {isAnalyzing ? 'Analyzing Details...' : 'Analyze & Edit'}
                    </button>
                </div>
                </div>
            )}

            {/* STEP 3: DETAILS */}
            {step === 3 && (
                <div className="space-y-6">
                    <div className="flex items-start gap-4 p-4 bg-green-50 border border-green-100 rounded-lg">
                        <CheckCircle className="text-green-600 mt-1 shrink-0" size={20} />
                        <div>
                            <p className="text-green-800 font-medium">Analysis Complete</p>
                            <p className="text-green-700 text-sm">Review extracted details.</p>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 space-y-6">
                        <h3 className="font-bold text-stone-400 text-xs uppercase tracking-wider border-b border-stone-100 pb-2">Product Details</h3>
                        <input 
                            value={analysisData.title} 
                            onChange={e => setAnalysisData({...analysisData, title: e.target.value})}
                            className="w-full p-3 border border-stone-200 rounded-lg font-serif text-lg focus:outline-none focus:border-gold-500"
                            placeholder="Product Title"
                        />
                         <div className="grid grid-cols-2 gap-4">
                            <select 
                                value={analysisData.category} 
                                onChange={e => setAnalysisData({...analysisData, category: e.target.value})}
                                className="w-full p-3 border border-stone-200 rounded-lg bg-white"
                            >
                                {['Necklace', 'Ring', 'Earrings', 'Bracelet', 'Bangle', 'Set', 'Other'].map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <input 
                                value={analysisData.subCategory || ''}
                                onChange={e => setAnalysisData({...analysisData, subCategory: e.target.value})}
                                placeholder="Sub-Category (e.g. Choker)"
                                className="w-full p-3 border border-stone-200 rounded-lg"
                            />
                        </div>
                        <textarea 
                            value={analysisData.description} 
                            onChange={e => setAnalysisData({...analysisData, description: e.target.value})}
                            className="w-full p-3 border border-stone-200 rounded-lg h-24 text-sm"
                            placeholder="Description"
                        />
                    </div>

                    <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200 space-y-6">
                        <h3 className="font-bold text-stone-500 text-xs uppercase tracking-wider border-b border-stone-200 pb-2 flex items-center gap-2">
                            <Briefcase size={14} /> Internal Manufacturing Data
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Supplier</label>
                                <input 
                                    value={analysisData.supplier || ''}
                                    onChange={e => setAnalysisData({...analysisData, supplier: e.target.value})}
                                    placeholder="Supplier Name"
                                    className="w-full p-3 border border-stone-200 rounded-lg bg-white"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Device / Camera</label>
                                <div className="relative">
                                    <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                                    <input 
                                        value={analysisData.meta?.cameraModel || ''}
                                        onChange={e => setAnalysisData({...analysisData, meta: {...analysisData.meta, cameraModel: e.target.value}})}
                                        className="w-full pl-10 pr-3 py-3 border border-stone-200 rounded-lg bg-white"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Date Taken</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                                    <input 
                                        type="date"
                                        value={analysisData.dateTaken || ''}
                                        onChange={e => setAnalysisData({...analysisData, dateTaken: e.target.value})}
                                        className="w-full pl-10 pr-3 py-3 border border-stone-200 rounded-lg bg-white"
                                    />
                                </div>
                            </div>
                             <div>
                                <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Uploaded By</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                                    <input 
                                        value={analysisData.uploadedBy || ''}
                                        readOnly
                                        className="w-full pl-10 pr-3 py-3 border border-stone-200 rounded-lg bg-stone-100 text-stone-500"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <button onClick={() => setStep(2)} className="p-3 rounded-lg text-stone-400 hover:bg-stone-50"><RefreshCw size={20} /></button>
                        <button onClick={handleSingleSave} className="flex-1 py-4 bg-stone-900 text-white rounded-xl font-medium shadow-lg hover:bg-stone-800 transition flex items-center justify-center gap-2">
                            <Save size={18} /> Save Product
                        </button>
                    </div>
                </div>
            )}
        </>
      )}
    </div>
  );
};