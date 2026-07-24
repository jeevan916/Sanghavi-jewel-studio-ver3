import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';

interface SecurityContextType {
  isSensitiveUI: boolean;
  setSensitiveUI: (sensitive: boolean) => void;
  triggerProtectionFlash: () => void;
}

const SecurityContext = createContext<SecurityContextType>({
  isSensitiveUI: false,
  setSensitiveUI: () => {},
  triggerProtectionFlash: () => {}
});

export const useSecurity = () => useContext(SecurityContext);

export const SecurityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [customSensitive, setCustomSensitive] = useState(false);
  const [flashActive, setFlashActive] = useState(false);
  const location = useLocation();

  // Automatically detect sensitive routes
  const isSensitiveRoute = useMemo(() => {
    const path = location.pathname.toLowerCase();
    return (
      path.includes('/product/') ||
      path.includes('/admin') ||
      path.includes('/shared/') ||
      path.includes('/wishlist') ||
      path.includes('/collection') ||
      path.includes('/staff') ||
      path.includes('/login')
    );
  }, [location.pathname]);

  const isSensitiveUI = isSensitiveRoute || customSensitive;

  const triggerProtectionFlash = () => {
    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 2000);
  };

  return (
    <SecurityContext.Provider value={{ isSensitiveUI, setSensitiveUI: setCustomSensitive, triggerProtectionFlash }}>
      {children}
    </SecurityContext.Provider>
  );
};

export const SecurityLayer: React.FC = () => {
  const { isSensitiveUI } = useSecurity();
  const location = useLocation();
  const [isProtectedState, setIsProtectedState] = useState(false);
  const [isCapturingAttempted, setIsCapturingAttempted] = useState(false);

  // Monitor visibility, keyboard shortcuts, and screen capture signals
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        document.body.style.filter = 'blur(12px) grayscale(100%)';
      } else {
        document.body.style.filter = 'none';
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Catch PrintScreen & Screenshot shortcuts during sensitive UI
      if (e.key === 'PrintScreen' || ((e.metaKey || e.ctrlKey) && e.shiftKey && ['3', '4', '5', 's', 'S'].includes(e.key))) {
        if (isSensitiveUI) {
          setIsCapturingAttempted(true);
          setTimeout(() => setIsCapturingAttempted(false), 2500);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.filter = 'none';
    };
  }, [isSensitiveUI]);

  // Route-level sensitivity active state
  useEffect(() => {
    setIsProtectedState(isSensitiveUI);
  }, [isSensitiveUI, location.pathname]);

  return (
    <>
      {/* High Z-Index Viewport-Wide Screenshot Prevention Overlay */}
      {isProtectedState && (
        <div
          id="screenshot-prevention-overlay"
          aria-hidden="true"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 999999,
            pointerEvents: 'none',
            backgroundColor: isCapturingAttempted ? '#000' : 'transparent',
            transition: 'background-color 0.15s ease',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            WebkitTouchCallout: 'none'
          }}
        >
          {/* Transparent canvas grid overlay pattern for screen recording / screenshot buffer protection */}
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              opacity: 0.001,
              pointerEvents: 'none'
            }}
          >
            <pattern id="sec-grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#ffffff" strokeWidth="0.5" />
            </pattern>
            <rect width="100%" height="100%" fill="url(#sec-grid)" />
          </svg>

          {/* Flash warning on captured attempts */}
          {isCapturingAttempted && (
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                color: '#ffffff',
                fontFamily: 'sans-serif',
                textAlign: 'center',
                padding: '24px 36px',
                background: 'rgba(28, 25, 23, 0.95)',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
                pointerEvents: 'auto'
              }}
            >
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🛡️</div>
              <div style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '0.05em' }}>
                PROTECTED DESIGN CONTENT
              </div>
              <div style={{ fontSize: '13px', color: '#a8a29e', marginTop: '6px' }}>
                Direct screenshot capture is disabled for sensitive studio items.
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};
