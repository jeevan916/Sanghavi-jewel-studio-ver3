
import React, { useState, useEffect } from 'react';
import { storeService } from '../services/storeService';
import { User } from '../types';
import { Lock, User as UserIcon, Loader2, KeyRound, ShieldCheck, AlertCircle, Phone } from 'lucide-react';

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

  useEffect(() => {
    /* global google */
    // Initialize Google Identity Services
    if (typeof google !== 'undefined') {
      google.accounts.id.initialize({
        client_id: "788258327176-s33t7p2h9h29643u7k2t9r7j6e7q7i8f.apps.googleusercontent.com", // Replace with actual Client ID
        callback: handleGoogleResponse
      });
      google.accounts.id.renderButton(
        document.getElementById("google-login-btn"),
        { theme: "outline", size: "large", width: "100%", text: "continue_with" }
      );
    }
  }, []);

  const handleGoogleResponse = async (response: any) => {
    setIsLoading(true);
    const user = await storeService.loginWithGoogle(response.credential);
    if (user) {
      // Ask for phone if missing
      if (!user.phone) {
        setOnboardingUser(user);
        setIsLoading(false);
      } else {
        onLoginSuccess(user);
      }
    } else {
      setError('Google Authentication Failed.');
      setIsLoading(false);
    }
  };

  const handleOnboardingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onboardingUser && phoneNumber) {
      const updated = storeService.updateUserProfile({ phone: phoneNumber });
      if (updated) onLoginSuccess(updated);
    }
  };

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    const user = await storeService.login(username, password);
    if (user) onLoginSuccess(user);
    else {
      setError('Invalid internal credentials.');
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
                <p className="text-stone-500 text-sm mt-2">To provide a bespoke experience, please share your contact number for quick inquiries.</p>
            </div>
            <form onSubmit={handleOnboardingSubmit} className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">Mobile Number</label>
                    <input 
                        type="tel" 
                        value={phoneNumber} 
                        onChange={e => setPhoneNumber(e.target.value)} 
                        className="w-full p-4 border border-stone-200 rounded-xl focus:border-gold-500 outline-none" 
                        placeholder="+91 98765 43210" 
                        required 
                    />
                </div>
                <button type="submit" className="w-full py-4 bg-gold-600 text-white rounded-xl font-bold shadow-lg hover:bg-gold-700 transition">Complete Profile</button>
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
                <div id="google-login-btn" className="w-full"></div>
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
                {error && <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg flex items-center gap-2"><AlertCircle size={14} /> {error}</div>}
                <button type="submit" disabled={isLoading} className="w-full py-3.5 bg-stone-800 text-white rounded-xl font-bold shadow-md hover:bg-stone-700 transition flex items-center justify-center gap-2">
                    {isLoading ? <Loader2 className="animate-spin" size={18}/> : <Lock size={18} />} Secure Access
                </button>
            </form>
        </div>
      </div>
    </div>
  );
};
