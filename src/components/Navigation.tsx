
import React, { useEffect, useState } from 'react';
import { Home, Sparkles, Upload, LayoutDashboard, LogIn, LogOut, Settings, LayoutGrid } from 'lucide-react';
import { User } from '@/types.ts';
import { storeService } from '@/services/storeService.ts';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Logo } from './Logo';

interface NavigationProps {
  user: User | null;
  onLogout: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({ user, onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(storeService.getIsOnline());
  
  useEffect(() => {
    return storeService.subscribeStatus(setIsOnline);
  }, []);

  const isStaff = user?.role === 'admin' || user?.role === 'contributor';
  const isStaffRoute = location.pathname.startsWith('/admin') || location.pathname === '/staff';

  const customerTabs = [
    { id: 'landing', path: '/', icon: Home, label: 'Studio' },
    { id: 'gallery', path: '/collection', icon: LayoutGrid, label: 'Catalog' },
  ];

  const staffTabs = [
    { id: 'dashboard', path: '/admin/dashboard', icon: LayoutDashboard, label: 'Admin' },
    { id: 'upload', path: '/admin/upload', icon: Upload, label: 'Stock' },
    { id: 'studio', path: '/admin/studio', icon: Sparkles, label: 'Studio' },
    { id: 'settings', path: '/admin/settings', icon: Settings, label: 'Prefs' },
  ];

  const activeTabs = isStaff ? [...customerTabs, ...staffTabs] : customerTabs;

  const isActive = (path: string) => {
    if (path === '/' && location.pathname !== '/') return false;
    return location.pathname.startsWith(path);
  };

  return (
    <nav className={`fixed bottom-0 left-0 right-0 z-50 pb-safe md:top-0 md:bottom-auto border-t md:border-t-0 md:border-b transition-all duration-500 ${
      isStaffRoute ? 'bg-black/90 border-white/5 text-stone-400' : 'bg-white/90 border-stone-100 text-brand-dark'
    } backdrop-blur-xl md:h-24 flex items-center shadow-2xl md:shadow-none`}>
      <div className="max-w-7xl mx-auto w-full px-8 flex justify-between items-center h-full gap-4">
        
        {/* Branding (Desktop) */}
        <Link to="/" className="hidden md:flex items-center gap-3 shrink-0 group">
            <Logo size="sm" showText={false} className="scale-90 origin-left group-hover:scale-100 transition-transform duration-500" />
            <div className="flex flex-col leading-none">
                <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-brand-dark">Sanghavi</span>
                <span className="text-[8px] font-serif italic text-stone-400 tracking-widest">Jewellers</span>
            </div>
        </Link>

        {/* Tab Items */}
        <div className={`flex flex-1 justify-around md:justify-center md:gap-16 overflow-x-auto scrollbar-hide py-2 ${isStaff ? 'md:max-w-none' : 'max-w-md mx-auto'}`}>
          {activeTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center gap-1.5 transition-all relative shrink-0 px-4 group ${
                isActive(tab.path)
                  ? (isStaffRoute ? 'text-white' : 'text-brand-dark')
                  : 'text-stone-400 hover:text-brand-gold'
              }`}
            >
              <tab.icon size={18} strokeWidth={isActive(tab.path) ? 2.5 : 2} className="group-hover:scale-110 transition-transform" />
              <span className="text-[8px] uppercase font-bold tracking-[0.2em]">{tab.label}</span>
              {isActive(tab.path) && (
                <div className={`absolute -bottom-2 md:-bottom-4 h-[3px] rounded-full w-6 ${isStaffRoute ? 'bg-brand-gold' : 'bg-brand-dark'} animate-fade-in`} />
              )}
            </button>
          ))}
          
          <div className="md:hidden flex items-center pl-4 ml-2 border-l border-stone-200/20">
             {user ? (
                <button onClick={onLogout} className="flex flex-col items-center gap-1.5 text-brand-red">
                  <LogOut size={18} />
                  <span className="text-[8px] uppercase font-bold tracking-widest">Exit</span>
                </button>
             ) : (
                <button onClick={() => navigate('/login')} className="flex flex-col items-center gap-1.5 text-brand-gold">
                  <LogIn size={18} />
                  <span className="text-[8px] uppercase font-bold tracking-widest">Login</span>
                </button>
             )}
          </div>
        </div>

        {/* Auth Actions (Desktop) */}
        <div className="hidden md:flex items-center gap-8 shrink-0">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'} shadow-[0_0_8px_rgba(16,185,129,0.5)]`} />
            <span className="text-[8px] uppercase font-bold tracking-widest text-stone-400">{isOnline ? 'Studio Online' : 'Offline'}</span>
          </div>
          {user ? (
            <button onClick={onLogout} className="text-[10px] uppercase font-bold tracking-[0.2em] text-stone-400 hover:text-brand-red transition-all flex items-center gap-2 group">
              <LogOut size={14} className="group-hover:-translate-x-1 transition-transform" /> Sign Out
            </button>
          ) : (
            <Link to="/login" className="text-[10px] uppercase font-bold tracking-[0.2em] text-stone-400 hover:text-brand-gold transition-all flex items-center gap-2 group">
              <LogIn size={14} className="group-hover:translate-x-1 transition-transform" /> Member Access
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};
