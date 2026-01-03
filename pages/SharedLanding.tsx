
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { storeService } from '../services/storeService';
import { Loader2, ShieldCheck, AlertCircle } from 'lucide-react';

export const SharedLanding: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const validateLink = async () => {
      if (!token) {
          setError("Invalid Link");
          return;
      }
      
      try {
        const data = await storeService.getSharedLinkDetails(token);
        
        // Wait a brief moment for visual feedback
        await new Promise(r => setTimeout(r, 800));

        if (data.type === 'product') {
            navigate(`/product/${data.targetId}`, { replace: true });
        } else if (data.type === 'category') {
            // Navigate to gallery with the category unlocked
            navigate('/collection', { 
                replace: true, 
                state: { sharedCategory: data.targetId } 
            });
        } else {
            setError("Unknown link type.");
        }
      } catch (err: any) {
        console.error(err);
        setError("This secure link has expired or is invalid.");
        setTimeout(() => navigate('/collection'), 3000);
      }
    };

    validateLink();
  }, [token, navigate]);

  if (error) {
      return (
        <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 text-center">
            <div className="bg-red-50 p-6 rounded-2xl border border-red-100 mb-4 animate-in zoom-in-95">
                <AlertCircle size={40} className="text-red-400 mx-auto mb-2" />
                <h2 className="font-serif text-xl font-bold text-stone-800">Access Denied</h2>
                <p className="text-stone-500 text-sm mt-2">{error}</p>
            </div>
            <p className="text-xs text-stone-400">Redirecting to public gallery...</p>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-stone-900 flex flex-col items-center justify-center text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-gold-600/10 blur-[100px] animate-pulse" />
      
      <div className="relative z-10 flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-700">
          <div className="w-20 h-20 bg-stone-800 rounded-full flex items-center justify-center shadow-2xl border border-stone-700">
              <ShieldCheck size={32} className="text-gold-500" />
          </div>
          
          <div className="text-center">
              <h1 className="font-serif text-2xl font-bold text-gold-500 mb-2">Sanghavi Secure Vault</h1>
              <p className="text-stone-400 text-xs uppercase tracking-[0.2em] font-bold">Verifying Access Token</p>
          </div>

          <div className="flex items-center gap-3 bg-white/5 px-6 py-3 rounded-full border border-white/10 backdrop-blur">
              <Loader2 className="animate-spin text-gold-500" size={16} />
              <span className="text-xs text-stone-300 font-mono">Decrypting content...</span>
          </div>
      </div>
    </div>
  );
};
