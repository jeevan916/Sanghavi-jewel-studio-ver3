
import React, { useState, useEffect } from 'react';
import { generateJewelryDesign } from '../services/geminiService';
import { GeneratedDesign, AspectRatio } from '../types';
import { storeService } from '../services/storeService';
import { Loader2, Download, Sparkles, Key, ExternalLink, Info } from 'lucide-react';

// Removed local declare global for window.aistudio to resolve conflicts with the environment-provided AIStudio type.

export const DesignStudio: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [history, setHistory] = useState<GeneratedDesign[]>([]);
  const [hasKey, setHasKey] = useState<boolean | null>(null);

  useEffect(() => {
    storeService.getDesigns().then(setHistory);
    checkKey();
  }, []);

  const checkKey = async () => {
    if (window.aistudio) {
      const selected = await window.aistudio.hasSelectedApiKey();
      setHasKey(selected);
    }
  };

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      // Assume success as per guidelines to avoid race condition
      setHasKey(true);
    }
  };

  const handleGenerate = async () => {
    if (!prompt) return;
    
    if (!hasKey) {
      await handleSelectKey();
    }

    setIsGenerating(true);
    setGeneratedImage(null);
    try {
      const base64Image = await generateJewelryDesign(prompt, aspectRatio);
      setGeneratedImage(base64Image);
      
      const newDesign: GeneratedDesign = {
        id: Date.now().toString(),
        imageUrl: base64Image,
        prompt,
        aspectRatio,
        createdAt: new Date().toISOString()
      };
      
      await storeService.addDesign(newDesign);
      setHistory(prev => [newDesign, ...prev]);
    } catch (error: any) {
      console.error(error);
      if (error?.message?.includes("Requested entity was not found")) {
        setHasKey(false);
        alert("API Key error. Please re-select your paid project API key.");
      } else {
        alert("Generation failed. High-quality imaging requires a paid Gemini API key.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const ratios: AspectRatio[] = ['1:1', '3:4', '4:3', '9:16', '16:9'];

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 pb-24 animate-fade-in">
      <header className="mb-8">
        <h2 className="font-serif text-3xl text-gold-700">Design Studio</h2>
        <p className="text-stone-500 mt-2">Generate high-fidelity bespoke jewelry concepts.</p>
      </header>

      {!hasKey && (
        <div className="mb-8 bg-gold-50 border border-gold-200 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-6 shadow-sm">
          <div className="bg-white p-4 rounded-full shadow-sm">
            <Key className="text-gold-600" size={32} />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="font-bold text-stone-800 text-lg">Pro Imaging Key Required</h3>
            <p className="text-stone-600 text-sm mt-1 max-w-md">
              High-quality 1K generation uses Gemini 3 Pro Image and requires a paid project API key from Google AI Studio.
            </p>
            <div className="mt-3 flex flex-wrap justify-center md:justify-start gap-4">
              <button 
                onClick={handleSelectKey}
                className="bg-gold-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-gold-700 transition"
              >
                Select API Key
              </button>
              <a 
                href="https://ai.google.dev/gemini-api/docs/billing" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-stone-500 text-sm flex items-center gap-1 hover:text-gold-600 transition"
              >
                Billing Docs <ExternalLink size={14} />
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
            <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">Concept Details</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="E.g., A luxury 18k white gold necklace featuring a central 5ct emerald cut diamond, surrounded by pear-shaped sapphires in a floral arrangement..."
              className="w-full p-4 border border-stone-200 rounded-xl min-h-[140px] focus:ring-2 focus:ring-gold-400 focus:outline-none resize-none text-stone-700 leading-relaxed"
            />
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
            <div className="flex items-center justify-between mb-4">
              <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest">Aspect Ratio</label>
              <span className="text-[10px] text-stone-400 font-medium">Resolution: 1K HD</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {ratios.map((r) => (
                <button
                  key={r}
                  onClick={() => setAspectRatio(r)}
                  className={`py-2 px-1 rounded-lg text-xs font-bold border transition-all ${
                    aspectRatio === r 
                    ? 'bg-gold-600 text-white border-gold-600' 
                    : 'bg-white text-stone-600 border-stone-200 hover:border-gold-300'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt}
            className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all ${
              isGenerating || !prompt
                ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                : 'bg-gold-600 text-white hover:bg-gold-700 shadow-xl shadow-gold-200'
            }`}
          >
            {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles size={22} />}
            {isGenerating ? 'Synthesizing...' : 'Generate Pro Concept'}
          </button>
        </div>

        <div className="flex flex-col gap-6">
          <div className={`relative w-full rounded-2xl overflow-hidden bg-stone-100 border border-stone-200 min-h-[400px] flex items-center justify-center ${isGenerating ? 'animate-pulse' : ''}`}>
             {generatedImage ? (
               <img src={generatedImage} alt="Generated Design" className="w-full h-full object-contain" />
             ) : (
               <div className="text-center p-8">
                 <div className="w-16 h-16 bg-stone-200 rounded-full flex items-center justify-center mx-auto mb-4 text-stone-400">
                   <Sparkles />
                 </div>
                 <p className="text-stone-400 text-sm font-medium">Specify details and click generate</p>
                 <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-stone-400 bg-white/50 px-3 py-1 rounded-full border border-stone-200 inline-flex">
                   <Info size={10} /> Powered by Gemini 3 Pro Image
                 </div>
               </div>
             )}
             
             {generatedImage && (
               <a 
                 href={generatedImage} 
                 download={`sanghavi-design-${Date.now()}.png`}
                 className="absolute bottom-4 right-4 p-3 bg-white/90 backdrop-blur rounded-full shadow-lg text-stone-800 hover:text-gold-600 transition-colors"
               >
                 <Download size={20} />
               </a>
             )}
          </div>
          
          {history.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest px-1">Recent Masterpieces</h4>
              <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
                {history.map((design) => (
                  <button 
                    key={design.id} 
                    onClick={() => {
                      setGeneratedImage(design.imageUrl);
                      setPrompt(design.prompt);
                      setAspectRatio(design.aspectRatio);
                    }}
                    className={`w-20 h-20 shrink-0 rounded-xl overflow-hidden border-2 transition-all ${
                      generatedImage === design.imageUrl ? 'border-gold-500 scale-105' : 'border-white hover:border-gold-200'
                    }`}
                  >
                    <img src={design.imageUrl} className="w-full h-full object-cover" alt="History" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
