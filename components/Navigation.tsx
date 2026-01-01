
import React, { useEffect, useState } from 'react';
import { Home, Sparkles, Upload, LayoutDashboard, LogIn, LogOut, Settings, LayoutGrid } from 'lucide-react';
import { User } from '../types';
import { storeService } from '../services/storeService';
import { useLocation, useNavigate, Link } from 'react-router-dom';

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
    <nav className={`fixed bottom-0 left-0 right-0 z-50 pb-safe md:top-0 md:bottom-auto border-t md:border-t-0 md:border-b transition-colors duration-500 ${
      isStaffRoute ? 'bg-stone-900/90 border-white/5 text-stone-400' : 'bg-white/95 border-stone-100 text-stone-500'
    } backdrop-blur-lg md:h-16 flex items-center`}>
      <div className="max-w-7xl mx-auto w-full px-4 flex justify-between items-center h-16 gap-2">
        
        {/* Branding (Desktop) */}
        <Link to="/" className="hidden md:flex items-center gap-3 shrink-0">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-serif font-bold text-lg ${isStaffRoute ? 'bg-white text-stone-900' : 'bg-stone-900 text-white'}`}>S</div>
            <div className="flex flex-col">
              <span className={`font-serif text-sm font-bold leading-none ${isStaffRoute ? 'text-white' : 'text-stone-900'}`}>Sanghavi</span>
              <span className="text-[8px] uppercase tracking-widest font-bold text-gold-500">Bespoke Jewel</span>
            </div>
        </Link>

        {/* Tab Items */}
        <div className={`flex flex-1 justify-around md:justify-center md:gap-8 overflow-x-auto scrollbar-hide py-1 ${isStaff ? 'md:max-w-none' : 'max-w-md mx-auto'}`}>
          {activeTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center gap-1 transition-all relative shrink-0 px-2 ${
                isActive(tab.path)
                  ? (isStaffRoute ? 'text-white' : 'text-gold-600')
                  : 'hover:text-gold-500'
              }`}
            >
              <tab.icon size={20} strokeWidth={isActive(tab.path) ? 2.5 : 2} />
              <span className="text-[9px] uppercase font-bold tracking-tighter md:tracking-normal">{tab.label}</span>
              {isActive(tab.path) && <div className={`absolute -bottom-1 h-0.5 rounded-full w-4 ${isStaffRoute ? 'bg-white' : 'bg-gold-500'}`} />}
            </button>
          ))}
          
          <div className="md:hidden flex items-center pl-2 ml-2 border-l border-stone-200/20">
             {user ? (
                <button onClick={onLogout} className="flex flex-col items-center gap-1 text-red-400">
                  <LogOut size={20} />
                  <span className="text-[9px] uppercase font-bold">Exit</span>
                </button>
             ) : (
                <button onClick={() => navigate('/login')} className="flex flex-col items-center gap-1 text-gold-500">
                  <LogIn size={20} />
                  <span className="text-[9px] uppercase font-bold">Login</span>
                </button>
             )}
          </div>
        </div>

        {/* Auth Actions (Desktop) */}
        <div className="hidden md:flex items-center gap-4 shrink-0">
          <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} title={isOnline ? 'Online' : 'Offline'} />
          {user ? (
            <button onClick={onLogout} className="text-xs uppercase font-bold text-stone-400 hover:text-red-500 transition-colors flex items-center gap-2">
              <LogOut size={16}/> Logout
            </button>
          ) : (
            <Link to="/login" className="text-xs uppercase font-bold text-stone-400 hover:text-gold-600 transition-colors flex items-center gap-2">
              <LogIn size={16}/> Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};
