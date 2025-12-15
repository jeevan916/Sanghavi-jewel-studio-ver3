import React, { useState, useEffect } from 'react';
import { generateJewelryDesign } from '../services/geminiService';
import { GeneratedDesign, AspectRatio } from '../types';
import { storeService } from '../services/storeService';
import { Loader2, Download, Eraser } from 'lucide-react';

export const DesignStudio: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [history, setHistory] = useState<GeneratedDesign[]>([]);

  useEffect(() => {
    storeService.getDesigns().then(setHistory);
  }, []);

  const handleGenerate = async () => {
    if (!prompt) return;
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
      setHistory([newDesign, ...history]);
    } catch (error) {
      alert("Generation failed. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const ratios: AspectRatio[] = ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9'];

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 pb-24">
      <header className="mb-8">
        <h2 className="font-serif text-3xl text-gold-700">Design Studio</h2>
        <p className="text-stone-500 mt-2">Generate bespoke jewelry concepts with AI.</p>
      </header>

      <div className="grid md:grid-cols-2 gap-8">
        {/* CONTROLS */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
            <label className="block text-sm font-medium text-stone-700 mb-2">Design Concept</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="E.g., A vintage rose gold ring with a large oval sapphire and small diamond halo..."
              className="w-full p-4 border border-stone-200 rounded-xl min-h-[120px] focus:ring-2 focus:ring-gold-400 focus:outline-none resize-none"
            />
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
            <label className="block text-sm font-medium text-stone-700 mb-3">Aspect Ratio</label>
            <div className="grid grid-cols-4 gap-2">
              {ratios.map((r) => (
                <button
                  key={r}
                  onClick={() => setAspectRatio(r)}
                  className={`py-2 px-3 rounded-lg text-sm border ${
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
            className={`w-full py-4 rounded-xl font-medium text-lg flex items-center justify-center gap-3 transition-all ${
              isGenerating || !prompt
                ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                : 'bg-gold-600 text-white hover:bg-gold-700 shadow-lg shadow-gold-200/50'
            }`}
          >
            {isGenerating ? <Loader2 className="animate-spin" /> : <SparklesIcon className="w-6 h-6" />}
            {isGenerating ? 'Generating Design...' : 'Generate Concept'}
          </button>
        </div>

        {/* OUTPUT */}
        <div className="flex flex-col gap-6">
          <div className={`relative w-full rounded-2xl overflow-hidden bg-stone-100 border border-stone-200 min-h-[400px] flex items-center justify-center ${isGenerating ? 'animate-pulse' : ''}`}>
             {generatedImage ? (
               <img src={generatedImage} alt="Generated Design" className="w-full h-full object-contain" />
             ) : (
               <div className="text-center p-8">
                 <div className="w-16 h-16 bg-stone-200 rounded-full flex items-center justify-center mx-auto mb-4 text-stone-400">
                   <SparklesIcon />
                 </div>
                 <p className="text-stone-400">Your masterpiece will appear here</p>
               </div>
             )}
             
             {generatedImage && (
               <a 
                 href={generatedImage} 
                 download="sanghavi-design.png"
                 className="absolute bottom-4 right-4 p-3 bg-white/90 backdrop-blur rounded-full shadow-lg text-stone-800 hover:text-gold-600"
               >
                 <Download size={20} />
               </a>
             )}
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-4">
             {history.map((design) => (
               <button 
                 key={design.id} 
                 onClick={() => setGeneratedImage(design.imageUrl)}
                 className="w-20 h-20 shrink-0 rounded-lg overflow-hidden border border-stone-200 focus:ring-2 focus:ring-gold-500"
               >
                 <img src={design.imageUrl} className="w-full h-full object-cover" />
               </button>
             ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const SparklesIcon = ({ className = "" }) => (
  <svg className={`w-5 h-5 ${className}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" fill="currentColor"/>
  </svg>
);