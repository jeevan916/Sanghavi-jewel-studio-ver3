
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { storeService } from '../services/storeService';
import { User } from '../types';
import { Lock, User as UserIcon, Key, Loader2, AlertCircle, Shield } from 'lucide-react';

export const StaffLogin: React.FC<{ onLoginSuccess: (u: User) => void }> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const user = await storeService.login(username, password);
      if (user) onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center p-6 text-stone-200 font-sans">
      <div className="max-w-md w-full bg-stone-900 p-10 rounded-3xl shadow-2xl border border-white/5 animate-in slide-in-from-bottom-4">
        <div className="text-center mb-10">
          <div className="bg-stone-800 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 text-gold-500 shadow-inner">
            <Shield size={32} />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Staff Authentication</h2>
          <p className="text-stone-500 text-sm mt-2">Sanghavi Studio Command Center</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-600" size={18} />
            <input 
              type="text" 
              value={username} 
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-stone-800 border-none rounded-2xl pl-12 pr-4 py-4 text-white focus:ring-2 focus:ring-gold-500 outline-none transition-all placeholder:text-stone-600"
              placeholder="Username"
              required
            />
          </div>
          <div className="relative">
            <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-600" size={18} />
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-stone-800 border-none rounded-2xl pl-12 pr-4 py-4 text-white focus:ring-2 focus:ring-gold-500 outline-none transition-all placeholder:text-stone-600"
              placeholder="Security Key"
              required
            />
          </div>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-xs">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-white text-stone-900 py-4 rounded-2xl font-bold hover:bg-gold-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20}/> : <Lock size={20}/>}
            Authorize Access
          </button>
        </form>

        <button onClick={() => navigate('/')} className="mt-8 w-full text-stone-600 text-[10px] font-bold uppercase tracking-widest hover:text-stone-400 transition-colors">
          Return to Customer Portal
        </button>
      </div>
    </div>
  );
};
