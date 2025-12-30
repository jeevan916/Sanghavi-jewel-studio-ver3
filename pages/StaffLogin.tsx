
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { storeService, HealthStatus } from '../services/storeService';
import { User } from '../types';
import { Lock, User as UserIcon, Shield, Loader2, AlertCircle, ArrowLeft, Wifi, WifiOff } from 'lucide-react';

export const StaffLogin: React.FC<{ onLoginSuccess: (u: User) => void }> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const navigate = useNavigate();

  // Check system health on load to ensure backend is reachable
  useEffect(() => {
    const checkStatus = async () => {
        const status = await storeService.checkServerHealth();
        setHealth(status);
    };
    checkStatus();
    const timer = setInterval(checkStatus, 10000);
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
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100">
      <div className="w-full max-w-md bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-2xl animate-in zoom-in-95 duration-500 relative overflow-hidden">
        
        {/* Connection Status Bar */}
        <div className={`absolute top-0 left-0 right-0 h-1 transition-colors duration-500 ${
            health?.healthy ? 'bg-teal-500' : health === null ? 'bg-slate-700' : 'bg-red-500 animate-pulse'
        }`} />

        <button onClick={() => navigate('/')} className="mb-8 text-slate-500 hover:text-white flex items-center gap-2 text-sm font-bold uppercase tracking-widest transition-colors">
          <ArrowLeft size={16}/> Back to Studio
        </button>

        <div className="text-center mb-10">
          <div className="inline-flex p-4 rounded-2xl bg-teal-500/10 text-teal-500 mb-4 border border-teal-500/20">
            <Shield size={32} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Staff Entrance</h1>
          <p className="text-slate-500 text-sm mt-2 font-mono">Sanghavi Studio Internal Operations</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Account Identifier</label>
            <div className="relative">
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18}/>
              <input 
                type="text" 
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                className="w-full bg-slate-800 border-none rounded-2xl pl-12 pr-4 py-4 text-white focus:ring-2 focus:ring-teal-500/50 outline-none placeholder:text-slate-600 transition-all"
                placeholder="Username"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Security Key</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18}/>
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full bg-slate-800 border-none rounded-2xl pl-12 pr-4 py-4 text-white focus:ring-2 focus:ring-teal-500/50 outline-none placeholder:text-slate-600 transition-all"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 text-red-400 text-xs animate-in slide-in-from-top-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button 
            type="submit" 
            disabled={isLoading || (health !== null && !health.healthy)}
            className="w-full bg-white text-slate-950 py-4 rounded-2xl font-bold hover:bg-teal-400 transition-all flex items-center justify-center gap-2 shadow-xl shadow-teal-500/5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20}/> : <Lock size={20}/>}
            {isLoading ? 'Authorizing...' : 'Secure Login'}
          </button>
        </form>

        <div className="mt-10 pt-6 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {health?.healthy ? (
                <span className="flex items-center gap-1.5 text-[10px] text-teal-500 font-bold uppercase tracking-tighter">
                    <Wifi size={12} /> System Online
                </span>
            ) : (
                <span className="flex items-center gap-1.5 text-[10px] text-red-500 font-bold uppercase tracking-tighter animate-pulse">
                    <WifiOff size={12} /> System Offline
                </span>
            )}
          </div>
          <p className="text-[9px] text-slate-600 uppercase font-bold tracking-widest">Auth v3.2</p>
        </div>
        
        {!health?.healthy && health?.reason && (
            <p className="mt-2 text-[10px] text-slate-700 text-center italic">Reason: {health.reason}</p>
        )}
      </div>
    </div>
  );
};
