import React from 'react';
import { PromptTemplate } from '@/types.ts';
import { Sparkles, X } from 'lucide-react';

interface TemplateSelectorModalProps {
    mode: 'enhance' | 'cleanup';
    templates: PromptTemplate[];
    onClose: () => void;
    onSelect: (promptOverride?: string) => void;
}

export const TemplateSelectorModal: React.FC<TemplateSelectorModalProps> = ({ mode, templates, onClose, onSelect }) => {
    return (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-6">
            <div className="bg-white rounded-[2rem] w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-300 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] border border-stone-100">
                <div className="p-6 bg-stone-50/50 border-b border-stone-100 flex justify-between items-center">
                    <div>
                        <h3 className="font-serif text-xl font-bold text-brand-dark flex items-center gap-2">
                            <Sparkles size={24} className="text-brand-gold"/> AI Studio
                        </h3>
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-0.5">Select Enhancement Style</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors text-stone-400 hover:text-brand-dark">
                        <X size={24} />
                    </button>
                </div>
                <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
                    <button 
                        onClick={() => onSelect()} 
                        className="w-full text-left p-4 rounded-2xl border border-stone-100 hover:border-brand-gold hover:bg-brand-gold/5 transition-all group flex items-center justify-between"
                    >
                        <span className="font-bold text-xs uppercase text-stone-500 group-hover:text-brand-dark tracking-widest">Standard (Default)</span>
                        <div className="w-2 h-2 rounded-full bg-stone-200 group-hover:bg-brand-gold"></div>
                    </button>
                    
                    {templates.map(t => (
                        <button 
                            key={t.id} 
                            onClick={() => onSelect(t.content)} 
                            className="w-full text-left p-4 rounded-2xl border border-stone-100 hover:border-brand-gold hover:bg-brand-gold/5 transition-all group flex items-center justify-between"
                        >
                            <span className="font-bold text-xs uppercase text-stone-500 group-hover:text-brand-dark tracking-widest">{t.label}</span>
                            <div className="w-2 h-2 rounded-full bg-stone-200 group-hover:bg-brand-gold"></div>
                        </button>
                    ))}
                </div>
                <div className="p-4 bg-stone-50/50 text-center">
                    <p className="text-[8px] font-bold text-stone-400 uppercase tracking-widest">Powered by Gemini Vision Pro</p>
                </div>
            </div>
        </div>
    );
};
