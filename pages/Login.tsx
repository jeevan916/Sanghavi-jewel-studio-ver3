import React, { useState } from 'react';
import { storeService } from '../services/storeService';
import { User } from '../types';
import { Lock, User as UserIcon, Loader2, KeyRound, ShieldCheck, AlertCircle } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const user = await storeService.login(username, password);
    if (user) {
      onLoginSuccess(user);
    } else {
      setError('Invalid credentials or connection error.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-stone-50 animate-fade-in">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-stone-100 overflow-hidden">
        <div className="bg-gold-600 p-8 text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent"></div>
            <h2 className="font-serif text-3xl text-white font-bold mb-2 relative z-10">Sanghavi</h2>
            <p className="text-gold-100 text-sm tracking-widest uppercase relative z-10">Jewel Studio</p>
        </div>
        
        <div className="p-8">
            <div className="flex items-center justify-center mb-6">
                <div className="bg-gold-50 p-3 rounded-full">
                    <ShieldCheck className="text-gold-600" size={32} />
                </div>
            </div>
            <h3 className="text-xl font-serif text-stone-800 mb-2 text-center">Employee Portal</h3>
            <p className="text-center text-stone-400 text-sm mb-6">Please sign in to access the studio tools.</p>
            
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Username</label>
                    <div className="relative">
                        <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                        <input 
                            type="text" 
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:border-gold-500 transition-colors bg-stone-50 focus:bg-white"
                            placeholder="Enter username"
                            required
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Password</label>
                    <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                        <input 
                            type="password" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:border-gold-500 transition-colors bg-stone-50 focus:bg-white"
                            placeholder="Enter password"
                            required
                        />
                    </div>
                </div>

                {error && (
                    <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg text-center flex items-center justify-center gap-2">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                <button 
                    type="submit" 
                    disabled={isLoading}
                    className="w-full py-4 bg-stone-900 text-white rounded-xl font-medium shadow-lg hover:bg-stone-800 transition-all flex items-center justify-center gap-2 mt-4"
                >
                    {isLoading ? <Loader2 className="animate-spin" /> : <Lock size={18} />}
                    {isLoading ? 'Verifying Access...' : 'Secure Login'}
                </button>
            </form>

            <div className="mt-8 border-t border-stone-100 pt-6">
                <div className="text-xs text-stone-500">
                    <p className="font-bold mb-2 uppercase text-stone-400">Default Access</p>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-stone-50 p-2 rounded border border-stone-100 text-center">
                            <span className="block font-bold text-stone-700">admin</span>
                            <span className="font-mono text-stone-400 text-[10px]">pass: admin</span>
                        </div>
                        <div className="bg-stone-50 p-2 rounded border border-stone-100 text-center">
                            <span className="block font-bold text-stone-700">staff</span>
                            <span className="font-mono text-stone-400 text-[10px]">pass: staff</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};