
import React, { useState, Suspense, lazy, useEffect } from 'react';
import { Navigation } from './components/Navigation';
import { storeService } from './services/storeService';
import { User, Product } from './types';
import { UploadProvider } from './contexts/UploadContext';
import { Loader2 } from 'lucide-react';

// Lazy load large page components
const Gallery = lazy(() => import('./pages/Gallery').then(m => ({ default: m.Gallery })));
const UploadWizard = lazy(() => import('./pages/UploadWizard').then(m => ({ default: m.UploadWizard })));
const DesignStudio = lazy(() => import('./pages/DesignStudio').then(m => ({ default: m.DesignStudio })));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const ProductDetails = lazy(() => import('./pages/ProductDetails').then(m => ({ default: m.ProductDetails })));

const PageLoader = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-gold-50/30 animate-in fade-in duration-500">
    <div className="relative mb-6">
        <Loader2 className="animate-spin text-gold-600" size={48} strokeWidth={1.5} />
        <div className="absolute inset-0 animate-ping bg-gold-400/20 rounded-full scale-150 blur-xl"></div>
    </div>
    <div className="flex flex-col items-center">
        <p className="font-serif text-2xl text-gold-800 mb-1 opacity-80">Sanghavi</p>
        <div className="h-0.5 w-12 bg-gold-300 mb-3 overflow-hidden rounded-full">
            <div className="h-full bg-gold-600 w-1/2 animate-[shimmer_1.5s_infinite_linear]"></div>
        </div>
        <p className="font-sans text-[10px] tracking-[0.3em] text-gold-500 uppercase font-bold animate-pulse">Initializing Studio</p>
    </div>
    <style>{`
      @keyframes shimmer {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(200%); }
      }
    `}</style>
  </div>
);

function AppContent() {
  const [user, setUser] = useState<User | null>(storeService.getCurrentUser());
  const [currentTab, setCurrentTab] = useState('gallery');
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [productContext, setProductContext] = useState<Product[]>([]);
  const [isResolvingLink, setIsResolvingLink] = useState(false);

  // --- Deep Link Resolution ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareToken = params.get('shareToken');

    if (shareToken) {
      const resolveToken = async () => {
        setIsResolvingLink(true);
        try {
          const link = await storeService.validateSharedLink(shareToken);
          if (link && link.type === 'product') {
            const product = await storeService.getProductById(link.targetId);
            if (product) {
              setActiveProduct(product);
              setProductContext([product]);
            } else {
              alert("Shared product no longer exists.");
            }
          } else {
            alert("This shared link is invalid or has expired.");
          }
        } catch (e) {
          console.error("Link resolution error:", e);
        } finally {
          setIsResolvingLink(false);
          // Clean up URL without refreshing
          const newUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);
        }
      };
      resolveToken();
    }
  }, []);

  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
    setCurrentTab(loggedInUser.role === 'admin' ? 'dashboard' : 'gallery');
  };

  const handleLogout = () => {
    storeService.logout();
    setUser(null);
    setCurrentTab('gallery');
  };

  const handleProductSelect = (product: Product, list: Product[]) => {
    setProductContext(list);
    setActiveProduct(product);
  };

  if (isResolvingLink) return <PageLoader />;

  if (activeProduct) {
    return (
      <Suspense fallback={<PageLoader />}>
        <ProductDetails 
          initialProduct={activeProduct} 
          productList={productContext} 
          onClose={() => setActiveProduct(null)} 
        />
      </Suspense>
    );
  }

  const renderPage = () => {
    switch (currentTab) {
      case 'gallery': return <Gallery onProductSelect={handleProductSelect} />;
      case 'upload': return user ? <UploadWizard /> : <Login onLoginSuccess={handleLoginSuccess} />;
      case 'studio': return user ? <DesignStudio /> : <Login onLoginSuccess={handleLoginSuccess} />;
      case 'dashboard': return user?.role === 'admin' ? <AdminDashboard onNavigate={setCurrentTab} /> : <Gallery />;
      case 'settings': return user?.role === 'admin' ? <Settings onBack={() => setCurrentTab('dashboard')} /> : <Gallery />;
      case 'login': return <Login onLoginSuccess={handleLoginSuccess} />;
      default: return <Gallery onProductSelect={handleProductSelect} />;
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 font-sans">
      <main className="pt-0 md:pt-16 pb-20 md:pb-0">
        <Suspense fallback={<PageLoader />}>
          {renderPage()}
        </Suspense>
      </main>
      <Navigation 
        currentTab={currentTab} 
        onTabChange={setCurrentTab} 
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
