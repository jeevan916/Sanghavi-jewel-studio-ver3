
import React, { useState, useEffect } from 'react';
import { storeService } from '../services/storeService';
import { User } from '../types';
import { Lock, User as UserIcon, Loader2, KeyRound, ShieldCheck, AlertCircle, Phone, Info } from 'lucide-react';

// Fix: Declare google as a global variable to satisfy TypeScript for Google Identity Services (GIS)
declare const google: any;

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Phone verification state for Google users
  const [onboardingUser, setOnboardingUser] = useState<User | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');

  const [googleInitError, setGoogleInitError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize Google Identity Services
    const initGoogle = () => {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      
      if (typeof google !== 'undefined') {
        try {
          google.accounts.id.initialize({
            client_id: clientId,
            callback: handleGoogleResponse,
            auto_select: false,
            cancel_on_tap_outside: true
          });
          
          google.accounts.id.renderButton(
            document.getElementById("google-login-btn"),
            { 
                theme: "outline", 
                size: "large", 
                width: "100%", 
                text: "continue_with",
                shape: "rectangular"
            }
          );
        } catch (err) {
          console.error("Google GIS Initialization failed:", err);
          setGoogleInitError("Google Sign-In configuration error. Please verify the Client ID.");
        }
      } else {
        // Retry logic if library is still loading
        setTimeout(initGoogle, 500);
      }
    };

    initGoogle();
  }, []);

  const handleGoogleResponse = async (response: any) => {
    setIsLoading(true);
    setError('');
    try {
      const user = await storeService.loginWithGoogle(response.credential);
      if (user) {
        // Logic: if customer doesn't have a phone, we MUST get it for insights
        if (!user.phone) {
          setOnboardingUser(user);
          setIsLoading(false);
        } else {
          onLoginSuccess(user);
        }
      } else {
        setError('Authentication service was unable to process Google credentials.');
        setIsLoading(false);
      }
    } catch (err) {
      setError('Login failed. Please ensure cookies are enabled.');
      setIsLoading(false);
    }
  };

  const handleOnboardingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onboardingUser && phoneNumber) {
      const updated = storeService.updateUserProfile({ phone: phoneNumber });
      if (updated) {
          onLoginSuccess(updated);
      }
    }
  };

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    const user = await storeService.login(username, password);
    if (user) {
      onLoginSuccess(user);
    } else {
      setError('Invalid internal staff credentials.');
      setIsLoading(false);
    }
  };

  if (onboardingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-stone-50 animate-fade-in">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gold-200">
            <div className="text-center mb-6">
                <div className="bg-gold-50 p-4 rounded-full inline-block mb-4"><Phone className="text-gold-600" size={32} /></div>
                <h2 className="text-2xl font-serif text-stone-800">Welcome, {onboardingUser.name}</h2>
                <p className="text-stone-500 text-sm mt-2">To provide a bespoke experience and track your liked designs, please share your contact number.</p>
            </div>
            <form onSubmit={handleOnboardingSubmit} className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">Mobile Number</label>
                    <input 
                        type="tel" 
                        value={phoneNumber} 
                        onChange={e => setPhoneNumber(e.target.value)} 
                        className="w-full p-4 border border-stone-200 rounded-xl focus:border-gold-500 outline-none text-lg" 
                        placeholder="+91 98765 43210" 
                        required 
                    />
                </div>
                <button type="submit" className="w-full py-4 bg-gold-600 text-white rounded-xl font-bold shadow-lg hover:bg-gold-700 transition transform active:scale-[0.98]">Complete Profile</button>
            </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-stone-50 animate-fade-in">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-stone-100 overflow-hidden">
        <div className="bg-stone-900 p-8 text-center text-white relative">
            <h2 className="font-serif text-3xl mb-1">Sanghavi</h2>
            <p className="text-gold-500 text-[10px] tracking-[0.4em] uppercase font-bold">Studio Gateway</p>
        </div>
        
        <div className="p-8">
            <div className="mb-8">
                <h3 className="text-sm font-bold text-stone-400 uppercase tracking-widest mb-4">Customer Access</h3>
                
                {googleInitError ? (
                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-3 text-amber-700 text-sm">
                        <AlertCircle size={18} className="shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold">Configuration Required</p>
                            <p className="opacity-80">Google Login ID is not yet configured for this domain. Please contact administrator.</p>
                        </div>
                    </div>
                ) : (
                    <div id="google-login-btn" className="w-full min-h-[44px]"></div>
                )}
                
                <p className="text-[10px] text-stone-400 mt-3 text-center">Login to view full collection & save favorites.</p>
            </div>

            <div className="relative mb-8 text-center">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-stone-100"></div></div>
                <span className="relative px-4 bg-white text-[10px] text-stone-400 uppercase font-bold tracking-widest">or staff login</span>
            </div>
            
            <form onSubmit={handleStaffSubmit} className="space-y-4">
                <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                    <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-stone-200 rounded-xl bg-stone-50 focus:bg-white focus:border-gold-500 outline-none" placeholder="Staff Username" required />
                </div>
                <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-stone-200 rounded-xl bg-stone-50 focus:bg-white focus:border-gold-500 outline-none" placeholder="Staff Password" required />
                </div>
                
                {error && (
                    <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg flex items-center gap-2 animate-pulse">
                        <AlertCircle size={14} /> {error}
                    </div>
                )}
                
                <button type="submit" disabled={isLoading} className="w-full py-3.5 bg-stone-800 text-white rounded-xl font-bold shadow-md hover:bg-stone-700 transition flex items-center justify-center gap-2">
                    {isLoading ? <Loader2 className="animate-spin" size={18}/> : <Lock size={18} />} Secure Access
                </button>
            </form>

            <div className="mt-8 pt-6 border-t border-stone-100 text-center">
                <p className="text-[10px] text-stone-400 uppercase tracking-widest">Authorized Access Only</p>
                <div className="flex justify-center gap-4 mt-2">
                    <ShieldCheck size={16} className="text-stone-300" />
                    <Info size={16} className="text-stone-300" />
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
