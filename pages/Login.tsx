
import React, { useState, useEffect } from 'react';
import { storeService } from '../services/storeService';
import { User as UserType } from '../types';
import { Lock, User as UserIcon, Loader2, KeyRound, ShieldCheck, AlertCircle, Phone, Info, HelpCircle, Wifi, WifiOff, Terminal, ArrowLeft, LogIn } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

interface LoginProps {
  onLoginSuccess: (user: UserType) => void;
  mode: 'customer' | 'staff';
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess, mode }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [isBackendOnline, setIsBackendOnline] = useState<boolean | null>(null);
  const [onboardingUser, setOnboardingUser] = useState<UserType | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const checkHealth = async () => {
        const health = await storeService.checkServerHealth();
        setIsBackendOnline(health.healthy);
    };
    checkHealth();
    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setIsLoading(true);
    setError('');
    
    try {
      const user = await storeService.login(username.trim(), password.trim());
      if (user) {
        onLoginSuccess(user);
      }
    } catch (err: any) {
      setError(err.message || 'Staff authentication server is unavailable.');
    } finally {
      setIsLoading(false);
    }
  };

  if (onboardingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-stone-50">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gold-200">
            <div className="text-center mb-6">
                <div className="bg-gold-50 p-4 rounded-full inline-block mb-4"><Phone className="text-gold-600" size={32} /></div>
                <h2 className="text-2xl font-serif text-stone-800">Final Step</h2>
                <p className="text-stone-500 text-sm mt-2">Enter your contact number to finalize your studio profile.</p>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); if(phoneNumber) onLoginSuccess(storeService.updateUserProfile({ phone: phoneNumber })!); }} className="space-y-4">
                <input type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} className="w-full p-4 border border-stone-200 rounded-xl outline-none text-lg text-center" placeholder="+91 98765 43210" required />
                <button type="submit" className="w-full py-4 bg-gold-600 text-white rounded-xl font-bold shadow-lg hover:bg-gold-700 transition">Complete Access</button>
            </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-stone-50 animate-fade-in">
      <div className={`max-w-md w-full bg-white rounded-2xl shadow-2xl border border-stone-100 overflow-hidden relative transition-all duration-500 ${mode === 'staff' ? 'ring-2 ring-stone-800' : 'ring-1 ring-gold-100'}`}>
        
        {/* Connection Bar */}
        <div className={`h-1 w-full ${isBackendOnline ? 'bg-green-500' : 'bg-red-500'} transition-colors duration-500`} />

        <div className={`p-8 text-center text-white relative ${mode === 'staff' ? 'bg-stone-900' : 'bg-stone-800'}`}>
            <div className="absolute top-4 left-4">
                <button onClick={() => navigate('/gallery')} className="text-stone-400 hover:text-white transition"><ArrowLeft size={20}/></button>
            </div>
            <h2 className="font-serif text-3xl mb-1">Sanghavi</h2>
            <p className="text-gold-500 text-[10px] tracking-[0.4em] uppercase font-bold">Studio Gateway</p>
            <div className="mt-4 inline-flex px-3 py-1 rounded-full border border-white/10 bg-black/20 text-[10px] uppercase font-bold tracking-widest text-stone-300">
                {mode === 'staff' ? 'Staff Entrance' : 'Customer Portal'}
            </div>
        </div>
        
        <div className="p-8">
            {mode === 'customer' ? (
                <div className="space-y-6 text-center">
                    <p className="text-stone-500 text-sm mb-4">Please use the WhatsApp portal to securely access the Sanghavi Jewel Studio collection.</p>
                    <button 
                      onClick={() => navigate('/login')}
                      className="w-full py-3.5 bg-green-600 text-white rounded-xl font-bold shadow-lg hover:bg-green-700 transition flex items-center justify-center gap-2"
                    >
                        <Phone size={18} /> Go to WhatsApp Login
                    </button>
                    <div className="pt-6 border-t border-stone-100 text-center">
                        <Link to="/staff" className="text-xs text-stone-400 hover:text-gold-600 font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2">
                             Internal Personnel? Click Here
                        </Link>
                    </div>
                </div>
            ) : (
                <form onSubmit={handleStaffSubmit} className="space-y-4">
                    <div className="relative">
                        <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                        <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-stone-200 rounded-xl bg-stone-50 focus:bg-white focus:border-gold-500 outline-none text-sm" placeholder="Staff Username" required />
                    </div>
                    <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-stone-200 rounded-xl bg-stone-50 focus:bg-white focus:border-gold-500 outline-none text-sm" placeholder="Security Code" required />
                    </div>
                    
                    {error && (
                        <div className="p-3 bg-red-50 text-red-700 text-[11px] rounded-lg border border-red-100 flex items-center gap-2">
                            <AlertCircle size={14} className="shrink-0" /> {error}
                        </div>
                    )}

                    <button type="submit" disabled={isLoading} className="w-full py-3.5 bg-stone-900 text-white rounded-xl font-bold shadow-lg hover:bg-stone-700 transition flex items-center justify-center gap-2 disabled:opacity-50">
                        {isLoading ? <Loader2 className="animate-spin" size={18}/> : <ShieldCheck size={18} />} Secure Authorize
                    </button>

                    <div className="pt-6 border-t border-stone-100 text-center">
                        <button type="button" onClick={() => setShowDiagnostics(!showDiagnostics)} className="text-[10px] text-stone-400 hover:text-stone-600 uppercase font-bold tracking-widest">Troubleshooting</button>
                    </div>

                    {showDiagnostics && (
                        <div className="mt-4 p-3 bg-stone-800 rounded-lg font-mono text-[9px] text-stone-400 space-y-1 animate-in slide-in-from-top-2">
                            <div className="flex justify-between text-white border-b border-white/10 pb-1 mb-1">
                                <span>STATUS</span>
                                <span>{isBackendOnline ? 'ONLINE' : 'OFFLINE'}</span>
                            </div>
                            <p>> check_port: 3000</p>
                            <p>> check_db: sanghavi_persistence/db.json</p>
                            <p>> check_root: admin/admin</p>
                        </div>
                    )}
                </form>
            )}
        </div>
      </div>
    </div>
  );
};
