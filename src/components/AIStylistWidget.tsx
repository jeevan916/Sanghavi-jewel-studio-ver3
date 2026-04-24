import React, { useState, useEffect } from 'react';
import { Sparkles, X, MessageCircle, Gem } from 'lucide-react';
import { storeService } from '@/services/storeService.ts';
import { generateCustomerInsight } from '@/services/geminiService.ts';
import { useNavigate } from 'react-router-dom';
import { User } from '@/types.ts';

interface AIStylistWidgetProps {
    user?: User | null;
}

export const AIStylistWidget: React.FC<AIStylistWidgetProps> = ({ user }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [insight, setInsight] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const navigate = useNavigate();

    // Check if user has enough history to show the widget
    useEffect(() => {
        const checkHistory = () => {
            const views = storeService.getRecentViews();
            const likes = storeService.getLikes();
            if (views.length >= 2 || likes.length >= 1) {
                setIsVisible(true);
            }
        };
        
        checkHistory();
        // Periodically check if they viewed more items
        const interval = setInterval(checkHistory, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleOpen = async () => {
        setIsOpen(true);
        if (insight) return; // already loaded

        setIsLoading(true);
        try {
            const views = storeService.getRecentViews();
            const likes = storeService.getLikes();
            const igFeed = await storeService.getInstagramFeed(3);
            const message = await generateCustomerInsight(views, likes, igFeed);
            setInsight(message);
        } catch (error) {
            setInsight("These pieces are truly special. We'd love to help you find the perfect match.");
        } finally {
            setIsLoading(false);
        }
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-24 right-4 md:bottom-8 md:right-8 z-50 flex flex-col items-end pointer-events-none">
            
            {/* The Chat Bubble */}
            <div className={`
                pointer-events-auto bg-white/95 backdrop-blur-xl border border-stone-200 
                rounded-2xl rounded-br-none shadow-2xl p-5 mb-4 max-w-[280px] sm:max-w-xs
                transition-all duration-500 origin-bottom-right
                ${isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-90 translate-y-4 pointer-events-none absolute bottom-16 right-0'}
            `}>
                <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-brand-gold/10 flex items-center justify-center border border-brand-gold/20">
                            <Sparkles className="text-brand-gold w-4 h-4" />
                        </div>
                        <div>
                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-brand-dark">AI Stylist</h4>
                            <p className="text-[8px] text-stone-400">By Sanghavi</p>
                        </div>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="text-stone-300 hover:text-stone-500 transition-colors p-1 -mr-2 -mt-2">
                        <X size={16} />
                    </button>
                </div>

                <div className="text-sm text-stone-600 font-sans leading-relaxed min-h-[60px] flex items-center">
                    {isLoading ? (
                        <div className="flex space-x-1 items-center opacity-50">
                            <div className="w-1.5 h-1.5 bg-brand-gold rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                            <div className="w-1.5 h-1.5 bg-brand-gold rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                            <div className="w-1.5 h-1.5 bg-brand-gold rounded-full animate-bounce"></div>
                            <span className="text-[10px] ml-2 text-stone-400 tracking-wider">Analyzing style...</span>
                        </div>
                    ) : (
                        <p>{insight}</p>
                    )}
                </div>

                {!isLoading && (
                    <button 
                        onClick={() => {
                            if (user) {
                                window.open('https://wa.me/', '_blank');
                            } else {
                                navigate('/login');
                            }
                        }}
                        className="w-full mt-4 bg-stone-50 hover:bg-stone-100 border border-stone-100 text-[9px] font-bold uppercase tracking-[0.2em] text-brand-dark py-2.5 rounded-xl transition-all"
                    >
                        {user ? 'Chat on WhatsApp' : 'Connect with us'}
                    </button>
                )}
            </div>

            {/* Floating Action Button */}
            <button 
                onClick={handleOpen}
                className={`
                    pointer-events-auto h-12 w-12 rounded-full shadow-xl flex items-center justify-center
                    transition-all duration-500 overflow-hidden border border-white/20
                    ${isOpen ? 'bg-stone-200 text-stone-500 scale-95 shadow-none' : 'bg-brand-dark text-white hover:scale-105 active:scale-95 hover:shadow-brand-gold/20'}
                `}
            >
                <div className="absolute inset-0 bg-gradient-to-tr from-brand-gold/20 to-transparent opacity-0 hover:opacity-100 transition-opacity"></div>
                {isOpen ? <X size={20} /> : <Sparkles size={22} className="animate-pulse" />}
                
                {/* Unread dot */}
                {!isOpen && !insight && (
                    <span className="absolute top-0 right-0 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-gold opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-brand-gold border-2 border-brand-dark"></span>
                    </span>
                )}
            </button>
        </div>
    );
};
