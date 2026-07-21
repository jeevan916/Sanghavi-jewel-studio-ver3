
import React, { Component, useState, Suspense, lazy, useEffect, ReactNode, ErrorInfo } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Navigation } from '@/components/Navigation.tsx';
import { storeService } from '@/services/storeService.ts';
import { User } from '@/types.ts';
import { UploadProvider } from '@/contexts/UploadContext.tsx';

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
const Landing = lazy(() => import('@/pages/Landing.tsx').then(m => ({ default: m.Landing })));
const Gallery = lazy(() => import('@/pages/Gallery.tsx').then(m => ({ default: m.Gallery })));
const UploadWizard = lazy(() => import('@/pages/UploadWizard.tsx').then(m => ({ default: m.UploadWizard })));
const DesignStudio = lazy(() => import('@/pages/DesignStudio.tsx').then(m => ({ default: m.DesignStudio })));
const AdminDashboard = lazy(() => import('@/pages/AdminDashboard.tsx').then(m => ({ default: m.AdminDashboard })));
const Settings = lazy(() => import('@/pages/Settings.tsx').then(m => ({ default: m.Settings })));
const CustomerLogin = lazy(() => import('@/pages/CustomerLogin.tsx').then(m => ({ default: m.CustomerLogin })));
const StaffLogin = lazy(() => import('@/pages/StaffLogin.tsx').then(m => ({ default: m.StaffLogin })));
const ProductDetails = lazy(() => import('@/pages/ProductDetails.tsx').then(m => ({ default: m.ProductDetails })));
const Wishlist = lazy(() => import('@/pages/Wishlist.tsx'));
const SharedLanding = lazy(() => import('@/pages/SharedLanding.tsx').then(m => ({ default: m.SharedLanding })));

interface AuthGuardProps {
  children?: ReactNode;
  allowedRoles: string[];
  user: User | null;
}

const AuthGuard = ({ children, allowedRoles, user }: AuthGuardProps) => {
  if (!user) {
    const isStaffRoute = window.location.pathname.startsWith('/admin') || window.location.pathname.startsWith('/staff');
    return <Navigate to={isStaffRoute ? "/staff" : "/login"} replace />;
  }
  if (!allowedRoles.includes(user.role)) return <Navigate to="/collection" replace />;
  return <>{children}</>;
};

const SecurityLayer = () => {
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                // Secondary privacy protection
                document.body.style.filter = 'blur(10px) grayscale(100%)';
            } else {
                document.body.style.filter = 'none';
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            document.body.style.filter = 'none';
        };
    }, []);

    return null;
};

import { SecurityBlackout } from '@/components/security/SecurityBlackout.tsx';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor.ts';

function AppContent() {
  usePerformanceMonitor('App');
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    const initializeApp = async () => {
        try {
            const currentUser = storeService.getCurrentUser();
            
            // Secure Session Validation for Staff
            if (currentUser && ['admin', 'manager', 'staff'].includes(currentUser.role)) {
                const isValid = await storeService.verifySession();
                if (!isValid) {
                    setUser(null);
                } else {
                    setUser(currentUser);
                }
            } else {
                setUser(currentUser);
            }
            
            // 🔥 WARM UP: Pre-fetch catalog data in the background
            storeService.warmup();
        } catch (e) {
            console.error("Initialization error", e);
        } finally {
            setIsInitializing(false);
            document.body.classList.add('loaded');
        }
    };
    
    initializeApp();
  }, []);

  const handleLogout = () => {
    storeService.logout();
    setUser(null);
  };

  const isStaffRoute = location.pathname.startsWith('/admin') || location.pathname === '/staff';
  
  if (isInitializing) {
      return <SafeLoader />;
  }

  return (
    <div className={`min-h-screen transition-colors duration-500 ${isStaffRoute ? 'bg-slate-950 text-slate-100' : 'bg-stone-50 text-stone-900'}`}>
      <SecurityLayer />
      <SecurityBlackout user={user} />
      <main className="pb-20 md:pb-0">
        <Suspense fallback={<SafeLoader />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/collection" element={<Gallery />} />
            <Route path="/gallery" element={<Navigate to="/collection" replace />} />
            <Route path="/wishlist" element={<Wishlist user={user} />} />
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
