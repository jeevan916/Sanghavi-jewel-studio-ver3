import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { storeService, HealthStatus } from '../services/storeService';
import { User } from '../types';
import { Lock, User as UserIcon, Shield, Loader2, AlertCircle, ArrowLeft, Wifi, WifiOff } from 'lucide-react';

import { Logo } from '@/components/Logo';

export const StaffLogin: React.FC<{ onLoginSuccess: (u: User) => void }> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showDebug, setShowDebug] = useState(false);
  const navigate = useNavigate();

  // Check system health on load to ensure backend is reachable
  useEffect(() => {
    const checkStatus = async () => {
        const status = await storeService.checkServerHealth();
        setHealth(status);
        if (!status.healthy && status.reason) {
            setError(`System Alert: ${status.reason}`);
        }
    };
    checkStatus();
    const timer = setInterval(checkStatus, 15000);
    return () => clearInterval(timer);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
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
      console.error("Login component caught error:", err);
      setError(err.message || 'Connection failed. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 text-brand-dark">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] p-12 border border-stone-100 shadow-2xl animate-fade-in relative overflow-hidden">
        
        {/* Connection Status Bar */}
        <div className={`absolute top-0 left-0 right-0 h-1.5 transition-all duration-700 ${
            health?.healthy ? 'bg-emerald-500' : health === null ? 'bg-stone-100' : 'bg-brand-red animate-pulse'
        }`} />

        <button onClick={() => navigate('/')} className="mb-10 text-stone-300 hover:text-brand-dark flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.3em] transition-all hover:bg-stone-50 px-4 py-2 rounded-full border border-transparent hover:border-stone-100">
          <ArrowLeft size={16}/> Back to Studio
        </button>

        <div className="text-center mb-12">
          <Logo size="md" showText={false} className="mb-8 mx-auto scale-110" />
          <h1 className="text-3xl font-serif font-bold tracking-tight">Personnel Portal</h1>
          <p className="text-stone-400 text-sm mt-3 font-serif italic">Sanghavi Studio Internal Operations</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-stone-400 ml-1">Account Identifier</label>
            <div className="relative group">
              <UserIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-stone-300 group-focus-within:text-brand-gold transition-colors" size={20}/>
              <input 
                type="text" 
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                className="w-full bg-stone-50 border border-stone-100 rounded-2xl pl-14 pr-6 py-5 text-brand-dark focus:ring-4 focus:ring-brand-gold/10 focus:bg-white focus:border-brand-gold/30 outline-none placeholder:text-stone-300 transition-all font-medium text-lg"
                placeholder="Username"
                required
                disabled={health !== null && !health.healthy}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-stone-400 ml-1">Security Key</label>
            <div className="relative group">
              <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-stone-300 group-focus-within:text-brand-gold transition-colors" size={20}/>
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full bg-stone-50 border border-stone-100 rounded-2xl pl-14 pr-6 py-5 text-brand-dark focus:ring-4 focus:ring-brand-gold/10 focus:bg-white focus:border-brand-gold/30 outline-none placeholder:text-stone-300 transition-all font-medium text-lg"
                placeholder="••••••••"
                required
                disabled={health !== null && !health.healthy}
              />
            </div>
          </div>

          {error && (
            <div className="p-4 bg-brand-red/5 border border-brand-red/10 rounded-2xl flex items-start gap-4 text-brand-red text-xs animate-shake">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="font-bold uppercase tracking-widest">Authentication Blocked</span>
                <span className="opacity-80">{error}</span>
              </div>
            </div>
          )}

          <button 
            type="submit" 
            disabled={isLoading || (health !== null && !health.healthy)}
            className="w-full bg-brand-dark text-white py-5 rounded-2xl font-bold uppercase tracking-[0.2em] text-xs hover:bg-brand-gold transition-all flex items-center justify-center gap-3 shadow-2xl shadow-brand-dark/20 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20}/> : <Shield size={20}/>}
            {isLoading ? 'Authorizing...' : 'Secure Login'}
          </button>
        </form>

        <div className="mt-12 pt-8 border-t border-stone-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {health?.healthy ? (
                <span className="flex items-center gap-2 text-[9px] text-emerald-600 font-bold uppercase tracking-widest">
                    <Wifi size={14} /> System Online
                </span>
            ) : (
                <span className="flex items-center gap-2 text-[9px] text-brand-red font-bold uppercase tracking-widest animate-pulse">
                    <WifiOff size={14} /> System Offline
                </span>
            )}
          </div>
          <p className="text-[9px] text-stone-300 uppercase font-bold tracking-[0.2em]">Auth v3.2.0</p>
        </div>
        
        {!health?.healthy && health?.reason && (
            <div className="mt-4 space-y-3">
               <div className="p-3 bg-red-950/30 rounded-xl border border-red-900/50">
                  <p className="text-[10px] text-red-300 text-center font-mono">
                    Diagnostic: {health.reason}
                  </p>
               </div>
               
               <button 
                 type="button"
                 onClick={async () => {
                   setIsLoading(true);
                   try {
                     const env = await storeService.getDebugEnv();
                     setDebugInfo(env);
                     setShowDebug(true);
                   } catch (e) {
                     setError("Failed to fetch debug info");
                   } finally {
                     setIsLoading(false);
                   }
                 }}
                 className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border border-slate-700"
               >
                 Inspect Environment
               </button>

               {showDebug && debugInfo && (
                 <div className="p-4 bg-black/40 rounded-2xl border border-slate-800 font-mono text-[9px] text-slate-400 space-y-2 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex justify-between border-b border-slate-800 pb-1">
                      <span>DB_HOST</span>
                      <span className="text-teal-400">{debugInfo.DB_HOST}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-800 pb-1">
                      <span>DB_USER</span>
                      <span className="text-teal-400">{debugInfo.DB_USER}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-800 pb-1">
                      <span>DB_NAME</span>
                      <span className="text-teal-400">{debugInfo.DB_NAME}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-800 pb-1">
                      <span>DB_PASS_LEN</span>
                      <span className="text-teal-400">{debugInfo.DB_PASSWORD_LENGTH}</span>
                    </div>
                    {debugInfo.dbInitError && (
                      <div className="text-red-400 pt-1 break-words">
                        Error: {debugInfo.dbInitError}
                      </div>
                    )}
                    <button 
                      type="button"
                      onClick={() => setShowDebug(false)}
                      className="w-full mt-2 py-1 text-slate-500 hover:text-white uppercase tracking-tighter"
                    >
                      [ Close Debug ]
                    </button>
                 </div>
               )}
            </div>
        )}
      </div>
    </div>
  );
};

export default StaffLogin;
