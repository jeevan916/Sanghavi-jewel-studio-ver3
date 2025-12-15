import React, { useState, useEffect } from 'react';
import { Navigation } from './components/Navigation';
import { Gallery } from './pages/Gallery';
import { UploadWizard } from './pages/UploadWizard';
import { DesignStudio } from './pages/DesignStudio';
import { AdminDashboard } from './pages/AdminDashboard';
import { Settings } from './pages/Settings';
import { Login } from './pages/Login';
import { ProductDetails } from './pages/ProductDetails';
import { storeService } from './services/storeService';
import { User, Product } from './types';
import { UploadProvider } from './contexts/UploadContext';

function AppContent() {
  const [currentTab, setCurrentTab] = useState('gallery');
  const [user, setUser] = useState<User | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // State for Product Details View
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [productContext, setProductContext] = useState<Product[]>([]);

  useEffect(() => {
    const initApp = async () => {
      const storedUser = storeService.getCurrentUser();
      setUser(storedUser);

      // Check for Secret Link
      const params = new URLSearchParams(window.location.search);
      const shareToken = params.get('shareToken');
      if (shareToken) {
          const sharedData = await storeService.validateSharedLink(shareToken);
          if (sharedData && sharedData.type === 'product') {
              const allProducts = await storeService.getProducts();
              const targetProduct = allProducts.find(p => p.id === sharedData.targetId);
              if (targetProduct) {
                  // Temporarily allow viewing this product even if private
                  // For a robust app, we would add this token to a 'whitelist' context
                  // For this demo, we just open it directly.
                  setActiveProduct(targetProduct);
                  setProductContext([targetProduct]); // Context is just this one product
                  
                  // Clear URL to clean up
                  window.history.replaceState({}, document.title, window.location.pathname);
              } else {
                  alert('Shared product not found or deleted.');
              }
          } else if (sharedData && sharedData.type === 'category') {
              // Handle Category Share (TODO: Set Filter in Gallery)
              alert('Shared category access granted.');
          } else {
              // Invalid or Expired
              if (shareToken) alert('This link has expired or is invalid.');
          }
      }

      setIsInitialized(true);
    };

    initApp();
  }, []);

  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
    if (loggedInUser.role === 'admin') {
      setCurrentTab('dashboard');
    } else if (loggedInUser.role === 'contributor') {
      setCurrentTab('upload');
    } else {
      setCurrentTab('gallery');
    }
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

  const handleProductClose = () => {
    setActiveProduct(null);
  };

  if (activeProduct) {
    return (
      <ProductDetails 
        initialProduct={activeProduct} 
        productList={productContext} 
        onClose={handleProductClose} 
      />
    );
  }

  const renderPage = () => {
    if (currentTab === 'login') {
      return <Login onLoginSuccess={handleLoginSuccess} />;
    }

    switch (currentTab) {
      case 'gallery': 
        return <Gallery onProductSelect={handleProductSelect} />;
      case 'upload': 
        return user ? <UploadWizard /> : <Login onLoginSuccess={handleLoginSuccess} />;
      case 'studio': 
        return user ? <DesignStudio /> : <Login onLoginSuccess={handleLoginSuccess} />;
      case 'dashboard': 
        return user ? <AdminDashboard onNavigate={setCurrentTab} /> : <Login onLoginSuccess={handleLoginSuccess} />;
      case 'settings':
        return user?.role === 'admin' ? <Settings /> : <AdminDashboard />;
      default: 
        return <Gallery onProductSelect={handleProductSelect} />;
    }
  };

  if (!isInitialized) return null;

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans selection:bg-gold-200">
      <main className="animate-fade-in">
        {renderPage()}
      </main>

      {currentTab !== 'login' && (
        <Navigation 
          currentTab={currentTab} 
          onTabChange={setCurrentTab} 
          user={user}
          onLogout={handleLogout}
        />
      )}
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