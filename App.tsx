import React, { useState, Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Navigation } from './components/Navigation';
import { storeService } from './services/storeService';
import { User, Product } from './types';
import { UploadProvider } from './contexts/UploadContext';
import { Loader2 } from 'lucide-react';

// True Multi-page Code Splitting
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
  <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50">
    <div className="relative flex flex-col items-center">
      <Loader2 className="animate-spin text-gold-600 mb-4" size={40} strokeWidth={1.5} />
      <span className="font-serif text-lg text-stone-400 animate-pulse">Sanghavi Studio</span>
    </div>
  </div>
);

// Guard Component
// Fix: Changed 'children' to optional to resolve call-site TypeScript validation errors when components are wrapped in AuthGuard.
interface AuthGuardProps {
  children?: React.ReactNode;
  allowedRoles: string[];
  user: User | null;
}

const AuthGuard = ({ children, allowedRoles, user }: AuthGuardProps) => {
  if (!user) {
    const isStaffRoute = window.location.hash.includes('/admin') || window.location.hash.includes('/staff');
    return <Navigate to={isStaffRoute ? "/staff" : "/login"} replace />;
  }
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/collection" replace />;
  }
  return <>{children}</>;
};

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const saved = storeService.getCurrentUser();
    if (saved) setUser(saved);
  }, []);

  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
    if (loggedInUser.role === 'customer') {
      navigate('/collection');
    } else {
      navigate('/admin/dashboard');
    }
  };

  const handleLogout = () => {
    storeService.logout();
    setUser(null);
    navigate('/');
  };

  const isStaffRoute = location.pathname.startsWith('/admin') || location.pathname === '/staff';

  return (
    <div className={`min-h-screen transition-colors duration-500 ${isStaffRoute ? 'bg-slate-950 text-slate-100' : 'bg-stone-50 text-stone-900'}`}>
      <main className="pb-20 md:pb-0 md:pt-0">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public/Customer Routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/collection" element={<Gallery onProductSelect={setActiveProduct} />} />
            <Route path="/login" element={<CustomerLogin onLoginSuccess={handleLoginSuccess} />} />
            
            {/* Staff Entry */}
            <Route path="/staff" element={<StaffLogin onLoginSuccess={handleLoginSuccess} />} />
            
            {/* Protected Admin Routes */}
            <Route path="/admin/dashboard" element={
              <AuthGuard user={user} allowedRoles={['admin', 'contributor']}>
                <AdminDashboard onNavigate={(p) => navigate(`/admin/${p}`)} />
              </AuthGuard>
            } />
            <Route path="/admin/upload" element={
              <AuthGuard user={user} allowedRoles={['admin', 'contributor']}>
                <UploadWizard />
              </AuthGuard>
            } />
            <Route path="/admin/studio" element={
              <AuthGuard user={user} allowedRoles={['admin']}>
                <DesignStudio />
              </AuthGuard>
            } />
            <Route path="/admin/settings" element={
              <AuthGuard user={user} allowedRoles={['admin']}>
                <Settings onBack={() => navigate(-1)} />
              </AuthGuard>
            } />

            {/* Redirects */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>

      {activeProduct && (
        <Suspense fallback={<PageLoader />}>
          <ProductDetails 
            initialProduct={activeProduct} 
            productList={[]} 
            onClose={() => setActiveProduct(null)} 
          />
        </Suspense>
      )}

      <Navigation user={user} onLogout={handleLogout} />
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
