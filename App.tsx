
import React, { useState, Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Navigation } from './components/Navigation';
import { storeService } from './services/storeService';
import { User, Product } from './types';
import { UploadProvider } from './contexts/UploadContext';
import { Loader2 } from 'lucide-react';

// Lazy load pages for true multipage performance
const Landing = lazy(() => import('./pages/Landing').then(m => ({ default: m.Landing })));
const Gallery = lazy(() => import('./pages/Gallery').then(m => ({ default: m.Gallery })));
const UploadWizard = lazy(() => import('./pages/UploadWizard').then(m => ({ default: m.UploadWizard })));
const DesignStudio = lazy(() => import('./pages/DesignStudio').then(m => ({ default: m.DesignStudio })));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const CustomerLogin = lazy(() => import('./pages/CustomerLogin').then(m => ({ default: m.CustomerLogin })));
const StaffLogin = lazy(() => import('./pages/StaffLogin').then(m => ({ default: m.StaffLogin })));
const ProductDetails = lazy(() => import('./pages/ProductDetails').then(m => ({ default: m.ProductDetails })));

const PageLoader = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-gold-50/20">
    <div className="relative">
      <Loader2 className="animate-spin text-gold-600 mb-4" size={48} strokeWidth={1} />
      <div className="absolute inset-0 blur-xl bg-gold-400/20 rounded-full scale-150 animate-pulse"></div>
    </div>
    <p className="font-serif text-xl text-gold-800 tracking-wide animate-pulse">Sanghavi Studio</p>
  </div>
);

// Fix: Make children optional in GuardProps to resolve TypeScript error where children are not correctly inferred from JSX
interface GuardProps {
  children?: React.ReactNode;
  user: User | null;
  requireAdmin?: boolean;
}

const StaffGuard = ({ children, user, requireAdmin }: GuardProps) => {
    if (!user) return <Navigate to="/staff" replace />;
    if (requireAdmin && user.role !== 'admin') return <Navigate to="/collection" replace />;
    if (user.role === 'customer') return <Navigate to="/collection" replace />;
    return <>{children}</>;
};

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const savedUser = storeService.getCurrentUser();
    if (savedUser) setUser(savedUser);
  }, []);

  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
    if (loggedInUser.role === 'admin' || loggedInUser.role === 'contributor') {
        navigate('/admin/dashboard');
    } else {
        navigate('/collection');
    }
  };

  const handleLogout = () => {
    storeService.logout();
    setUser(null);
    navigate('/');
  };

  const isStaffRoute = location.pathname.startsWith('/admin') || location.pathname === '/staff';

  return (
    <div className={`min-h-screen font-sans selection:bg-gold-200 ${isStaffRoute ? 'bg-stone-950 text-stone-200' : 'bg-stone-50 text-stone-900'}`}>
      <main className="pb-20 md:pb-0">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* --- CUSTOMER PORTAL --- */}
            <Route path="/" element={<Landing />} />
            <Route path="/collection" element={<Gallery onProductSelect={(p) => setActiveProduct(p)} />} />
            <Route path="/login" element={<CustomerLogin onLoginSuccess={handleLoginSuccess} />} />
            
            {/* --- STAFF PORTAL --- */}
            <Route path="/staff" element={<StaffLogin onLoginSuccess={handleLoginSuccess} />} />
            
            <Route path="/admin/upload" element={
                <StaffGuard user={user}><UploadWizard /></StaffGuard>
            } />
            
            <Route path="/admin/dashboard" element={
                <StaffGuard user={user}><AdminDashboard onNavigate={(tab) => navigate(`/admin/${tab}`)} /></StaffGuard>
            } />
            
            <Route path="/admin/studio" element={
                <StaffGuard user={user}><DesignStudio /></StaffGuard>
            } />
            
            <Route path="/admin/settings" element={
                <StaffGuard user={user} requireAdmin><Settings onBack={() => navigate(-1)} /></StaffGuard>
            } />

            {/* Global Redirects */}
            <Route path="/upload" element={<Navigate to="/admin/upload" replace />} />
            <Route path="/studio" element={<Navigate to="/admin/studio" replace />} />
            <Route path="/dashboard" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/settings" element={<Navigate to="/admin/settings" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>

      {/* Details Modal (Overlay) */}
      {activeProduct && (
        <Suspense fallback={<PageLoader />}>
          <ProductDetails 
            initialProduct={activeProduct} 
            productList={[]} 
            onClose={() => setActiveProduct(null)} 
          />
        </Suspense>
      )}

      {/* Universal Navigation */}
      <Navigation 
        user={user}
        onLogout={handleLogout}
      />
    </div>
  );
}

export default function App() {
  return (
    <UploadProvider>
      <AppContent />
    </UploadProvider>
  );
}
