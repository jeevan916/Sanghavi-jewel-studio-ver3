import React, { Component, useState, Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Navigation } from './components/Navigation';
import { storeService } from './services/storeService';
import { User } from './types';
import { UploadProvider } from './contexts/UploadContext';
import { Loader2, RefreshCcw, AlertTriangle } from 'lucide-react';

// Error Boundary Implementation
interface ErrorBoundaryProps {
  children?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Sanghavi Studio Exception:", error, errorInfo);
    document.body.classList.add('loaded');
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-red-50 p-8 rounded-3xl border border-red-100 flex flex-col items-center max-sm shadow-xl">
            <AlertTriangle className="text-red-500 mb-4" size={48} />
            <h1 className="font-serif text-2xl text-stone-900 mb-2">Studio Interrupted</h1>
            <p className="text-stone-500 mb-6 text-sm">A module failed to initialize. This is often due to a poor connection to the server vault.</p>
            <button 
              onClick={() => window.location.reload()} 
              className="flex items-center gap-2 bg-stone-900 text-white px-8 py-3 rounded-2xl font-bold shadow-lg"
            >
              <RefreshCcw size={18}/> Hard Refresh
            </button>
          </div>
        </div>
      );
    }
    
    return this.props.children;
  }
}

// Lazy Load Pages
const Landing = lazy(() => import('./pages/Landing').then(m => ({ default: m.Landing })));
const Gallery = lazy(() => import('./pages/Gallery').then(m => ({ default: m.Gallery })));
const UploadWizard = lazy(() => import('./pages/UploadWizard').then(m => ({ default: m.UploadWizard })));
const DesignStudio = lazy(() => import('./pages/DesignStudio').then(m => ({ default: m.DesignStudio })));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const CustomerLogin = lazy(() => import('./pages/CustomerLogin').then(m => ({ default: m.CustomerLogin })));
const StaffLogin = lazy(() => import('./pages/StaffLogin').then(m => ({ default: m.StaffLogin })));
const ProductDetails = lazy(() => import('./pages/ProductDetails').then(m => ({ default: m.ProductDetails })));
const Consultant = lazy(() => import('./pages/Consultant').then(m => ({ default: m.Consultant })));
const SharedLanding = lazy(() => import('./pages/SharedLanding').then(m => ({ default: m.SharedLanding })));


const PageLoader = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50">
    <Loader2 className="animate-spin text-gold-600 mb-4" size={40} strokeWidth={1.5} />
    <span className="font-serif text-lg text-stone-400 animate-pulse uppercase tracking-[0.2em] text-[10px] font-bold">Synchronizing...</span>
  </div>
);

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
  if (!allowedRoles.includes(user.role)) return <Navigate to="/collection" replace />;
  return <>{children}</>;
};

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Fix: Reset scroll position to top on every route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    setUser(storeService.getCurrentUser());
    document.body.classList.add('loaded');
  }, []);

  const handleLogout = () => {
    storeService.logout();
    setUser(null);
  };

  const isStaffRoute = location.pathname.startsWith('/admin') || location.pathname === '/staff';

  return (
    <div className={`min-h-screen transition-colors duration-500 ${isStaffRoute ? 'bg-slate-950 text-slate-100' : 'bg-stone-50 text-stone-900'}`}>
      <main className="pb-20 md:pb-0">
        <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/collection" element={<Gallery />} />
                <Route path="/product/:id" element={<ProductDetails />} />
                <Route path="/shared/:token" element={<SharedLanding />} />
                <Route 
                    path="/login" 
                    element={
                        <CustomerLogin onLoginSuccess={(u) => { 
                            setUser(u); 
                            const from = (location.state as any)?.from;
                            navigate(from || '/collection', { replace: true }); 
                        }} />
                    } 
                />
                <Route path="/staff" element={<StaffLogin onLoginSuccess={(u) => { setUser(u); navigate('/admin/dashboard'); }} />} />
                <Route path="/consultant" element={<Consultant />} />
                <Route path="/admin/dashboard" element={<AuthGuard user={user} allowedRoles={['admin', 'contributor']}><AdminDashboard onNavigate={(p) => navigate(`/admin/${p}`)} /></AuthGuard>} />
                <Route path="/admin/upload" element={<AuthGuard user={user} allowedRoles={['admin', 'contributor']}><UploadWizard /></AuthGuard>} />
                <Route path="/admin/studio" element={<AuthGuard user={user} allowedRoles={['admin']}><DesignStudio /></AuthGuard>} />
                <Route path="/admin/settings" element={<AuthGuard user={user} allowedRoles={['admin']}><Settings onBack={() => navigate(-1)} /></AuthGuard>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
        </ErrorBoundary>
      </main>

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