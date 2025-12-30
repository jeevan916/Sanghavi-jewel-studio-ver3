
import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { storeService } from '../services/storeService';
import { User } from '../types';
import { ArrowLeft, Loader2, Info, ShieldCheck } from 'lucide-react';

declare const google: any;

export const CustomerLogin: React.FC<{ onLoginSuccess: (u: User) => void }> = ({ onLoginSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const initGoogle = () => {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      if (typeof google !== 'undefined' && clientId) {
        google.accounts.id.initialize({
          client_id: clientId,
          callback: async (res: any) => {
            setIsLoading(true);
            const user = await storeService.loginWithGoogle(res.credential);
            if (user) onLoginSuccess(user);
            setIsLoading(false);
          },
          auto_select: false
        });
        google.accounts.id.renderButton(
          document.getElementById("google-btn"),
          { theme: "outline", size: "large", width: "100%" }
        );
      } else {
        setTimeout(initGoogle, 300);
      }
    };
    initGoogle();
  }, []);

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6 animate-fade-in">
      <div className="max-w-md w-full bg-white p-10 rounded-3xl shadow-2xl border border-stone-100 relative">
        <button onClick={() => navigate('/')} className="absolute top-6 left-6 text-stone-400 hover:text-stone-900 transition"><ArrowLeft size={24}/></button>
        
        <div className="text-center mb-10">
          <h2 className="font-serif text-3xl text-stone-800 mb-2">Welcome</h2>
          <p className="text-stone-500 font-light">Sign in to unlock personalized collections and AI design services.</p>
        </div>

        <div id="google-btn" className="min-h-[44px]"></div>

        <div className="mt-12 pt-8 border-t border-stone-100 text-center space-y-4">
          <p className="text-[10px] uppercase font-bold tracking-widest text-stone-300">Personnel Portal</p>
          <Link to="/staff" className="text-gold-600 text-xs font-bold hover:underline">Internal Staff Entry →</Link>
        </div>
        
        <div className="mt-8 flex justify-center gap-4 text-stone-200">
          <ShieldCheck size={20}/>
          <Info size={20}/>
        </div>
      </div>
      {isLoading && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <Loader2 className="animate-spin text-gold-600" size={48} />
        </div>
      )}
    </div>
  );
};
