
import React, { useEffect, useState } from 'react';
import { Home, Sparkles, Upload, LayoutDashboard, LogIn, LogOut, Loader2, Wifi, WifiOff, Settings } from 'lucide-react';
import { User } from '../types';
import { useUpload } from '../contexts/UploadContext';
import { storeService } from '../services/storeService';

interface NavigationProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  user: User | null;
  onLogout: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentTab, onTabChange, user, onLogout }) => {
  const [isOnline, setIsOnline] = useState(storeService.getIsOnline());
  
  useEffect(() => {
    const unsubscribe = storeService.subscribeStatus(setIsOnline);
    return unsubscribe;
  }, []);

  const isAdmin = user?.role === 'admin';
  const isContributor = user?.role === 'contributor' || isAdmin;
  const isStaff = isContributor;
  
  let uploadState = { queue: [], isProcessing: false };
  try {
    uploadState = useUpload();
  } catch (e) {}
  const pendingUploads = uploadState.queue.filter(i => i.status === 'pending' || i.status === 'analyzing' || i.status === 'saving').length;

  const tabs = [
    { id: 'gallery', icon: Home, label: 'Collection' },
  ];

  if (isContributor) {
    tabs.push({ id: 'upload', icon: Upload, label: 'Upload' });
  }

  if (isAdmin) {
    tabs.push({ id: 'studio', icon: Sparkles, label: 'Studio' });
    tabs.push({ id: 'dashboard', icon: LayoutDashboard, label: 'Admin' });
  }

  if (isStaff) {
    tabs.push({ id: 'settings', icon: Settings, label: 'Settings' });
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-gold-200 z-50 pb-safe md:top-0 md:bottom-auto md:px-8 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] md:shadow-sm">
      <div className="max-w-7xl mx-auto flex justify-between items-center h-16 px-4 md:px-0">
        
        <div className="hidden md:flex items-center gap-4">
            <div className="flex flex-col">
                <span className="font-serif text-2xl text-gold-700 font-bold leading-none">Sanghavi</span>
                <div className="flex items-center gap-1">
                    <span className="font-sans text-[8px] tracking-[0.2em] text-gold-500 uppercase font-bold">Jewel Studio</span>
                    {isStaff && (
                        <span className="bg-gold-100 text-gold-700 text-[8px] px-1.5 py-0.5 rounded font-bold uppercase ml-1">
                            {user?.role}
                        </span>
                    )}
                </div>
            </div>
            
            <div className={`hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${isOnline ? 'bg-green-50 text-green-700 border-green-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                {isOnline ? <Wifi size={12}/> : <WifiOff size={12}/>}
                <span>{isOnline ? 'Connected' : 'Offline'}</span>
            </div>
        </div>
        
        <div className="md:hidden absolute top-0 left-4 -translate-y-full bg-white/90 px-2 py-1 rounded-t-lg border-t border-x border-gold-200 text-[10px] font-bold flex items-center gap-1">
            {isOnline ? <span className="w-2 h-2 rounded-full bg-green-500"/> : <WifiOff size={10} className="text-orange-500"/>}
            <span className={isOnline ? 'text-green-700' : 'text-orange-600'}>
                {isOnline ? 'Live' : 'Cached'}
            </span>
        </div>

        <div className="flex flex-1 md:flex-none justify-around md:justify-end md:gap-6 lg:gap-8 items-center w-full md:w-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col md:flex-row items-center gap-1 p-2 transition-all relative ${
                currentTab === tab.id
                  ? 'text-gold-600 scale-105'
                  : 'text-stone-400 hover:text-gold-400'
              }`}
            >
              <tab.icon size={20} strokeWidth={currentTab === tab.id ? 2 : 1.5} />
              <span className="text-[9px] md:text-xs font-bold uppercase tracking-tighter md:tracking-normal">{tab.label}</span>
              
              {tab.id === 'upload' && pendingUploads > 0 && (
                  <span className="absolute top-1 right-1 md:-top-1 md:-right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-gold-500 text-[9px] text-white items-center justify-center">
                        {pendingUploads}
                    </span>
                  </span>
              )}
            </button>
          ))}

          <div className="w-px h-8 bg-stone-200 mx-2 hidden md:block"></div>

          {user ? (
            <button
              onClick={onLogout}
              className="flex flex-col md:flex-row items-center gap-1 p-2 text-stone-400 hover:text-red-500 transition-colors"
            >
              <LogOut size={20} strokeWidth={1.5} />
              <span className="text-[9px] md:text-xs font-bold uppercase">Logout</span>
            </button>
          ) : (
            <button
              onClick={() => onTabChange('login')}
              className="flex flex-col md:flex-row items-center gap-1 p-2 text-stone-400 hover:text-gold-600 transition-colors"
            >
              <LogIn size={20} strokeWidth={1.5} />
              <span className="text-[9px] md:text-xs font-bold uppercase tracking-tighter">Login</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};
