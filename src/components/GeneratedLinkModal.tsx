import React from 'react';
import { X, CheckCircle, Copy, Share2 } from 'lucide-react';

interface GeneratedLinkModalProps {
    link: string;
    onClose: () => void;
}

export const GeneratedLinkModal: React.FC<GeneratedLinkModalProps> = ({ link, onClose }) => {
    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-stone-400 hover:text-stone-800"><X size={20}/></button>
                <div className="flex flex-col items-center text-center gap-4">
                    <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center">
                        <CheckCircle size={29} />
                    </div>
                    <div>
                        <h3 className="font-serif text-xl font-bold text-stone-800">Private Link Ready</h3>
                        <p className="text-stone-500 text-xs mt-1">This secure link expires in 24 hours.</p>
                    </div>
                    
                    <div className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl break-all text-xs font-mono text-stone-600 select-all">
                        {link}
                    </div>

                    <div className="flex gap-2 w-full">
                         <button 
                            onClick={() => {
                                navigator.clipboard.writeText(link);
                                onClose();
                                alert("Copied to clipboard");
                            }}
                            className="flex-1 py-3 bg-stone-900 text-white rounded-xl font-bold uppercase text-[10px] tracking-widest flex items-center justify-center gap-2"
                         >
                            <Copy size={17} /> Copy Link
                         </button>
                         <button 
                             onClick={() => {
                                 if (navigator.share) {
                                     navigator.share({ title: 'Private View', url: link }).catch(()=>{});
                                 } else {
                                     window.open(`https://wa.me/?text=${encodeURIComponent(link)}`, '_blank');
                                 }
                             }}
                             className="px-4 py-3 bg-green-50 text-green-700 rounded-xl font-bold uppercase text-[10px] tracking-widest border border-green-100"
                         >
                            <Share2 size={19} />
                         </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
