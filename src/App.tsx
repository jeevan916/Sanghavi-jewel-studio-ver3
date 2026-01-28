import React, { Component, useState, Suspense, lazy, useEffect, ReactNode, ErrorInfo } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Navigation } from './components/Navigation';
import { storeService } from './services/storeService';
import { User } from './types';
import { UploadProvider } from './contexts/UploadContext';

// Safe Loader Component (No external dependencies)
const SafeLoader = () => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#fbf8f1' }}>
    <div style={{ width: '40px', height: '40px', border: '3px solid #ebdbb2', borderTop: '3px solid #c68a36', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    <span style={{ marginTop: '16px', fontFamily: 'serif', color: '#c68a36', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.2em' }}>Initializing...</span>
  </div>
);

// Robust Error Boundary
interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false };
  // explicit props declaration removed to avoid TS conflict with Component

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Sanghavi Studio Exception:", error, errorInfo);
    document.body.classList.add('loaded');
  }

  handleHardReset = () => {
    localStorage.clear();
    sessionStorage.clear();
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
    window.location.href = '/';
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: '20px', backgroundColor: '#fff', color: '#333', textAlign: 'center', fontFamily: 'sans-serif' }}>
          <h1 style={{ fontSize: '24px', marginBottom: '10px', color: '#c68a36', fontFamily: 'serif' }}>Studio Recovering</h1>
          <p style={{ marginBottom: '20px', fontSize: '14px', color: '#666', maxWidth: '300px' }}>
            We encountered a startup issue. This is usually fixed by clearing the local cache.
          </p>
          <button 
            onClick={this.handleHardReset}
            style={{ padding: '12px 24px', backgroundColor: '#1c1917', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px' }}
          >
            Reset Application
          </button>
          <button 
            onClick={() => window.location.reload()}
            style={{ marginTop: '12px', padding: '10px', background: 'none', border: 'none', color: '#999', fontSize: '12px', textDecoration: 'underline', cursor: 'pointer' }}
          >
            Try Reloading
          </button>
        </div>
      );
    }
    
    // Explicitly cast this to avoid TS error: Property 'props' does not exist on type 'ErrorBoundary'
    return (this as any).props.children;
  }
}

// Lazy Load Pages
const Landing = lazy(() => import('./pages/Landing').then(m => ({ default: m.Landing })));
const Gallery = lazy(() => import('./pages/Gallery').then(m => ({ default: m.Gallery })));
const UploadWizard = lazy(() => import('./pages/UploadWizard').then(m => ({ default: m.UploadWizard })));
const DesignStudio = lazy(() => import('./pages/DesignStudio').then(m => ({ default: m.DesignStudio })));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const Settings = lazy(() => import('./pages/Settings'));
const CustomerLogin = lazy(() => import('./pages/CustomerLogin'));
const StaffLogin = lazy(() => import('./pages/StaffLogin'));
const ProductDetails = lazy(() => import('./pages/ProductDetails').then(m => ({ default: m.ProductDetails })));
const Consultant = lazy(() => import('./pages/Consultant').then(m => ({ default: m.Consultant })));
const SharedLanding = lazy(() => import('./pages/SharedLanding').then(m => ({ default: m.SharedLanding })));

interface AuthGuardProps {
  children?: ReactNode;
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

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    try {
        const currentUser = storeService.getCurrentUser();
        setUser(currentUser);
    } catch (e) {
        console.error("User fetch error", e);
    }
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
        <Suspense fallback={<SafeLoader />}>
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
      </main>

      <Navigation user={user} onLogout={handleLogout} />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <UploadProvider>
        <AppContent />
      </UploadProvider>
    </ErrorBoundary>
  );
}