import React, { createContext, useContext } from 'react';

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
  return (
    <SecurityContext.Provider value={{ isSensitiveUI: false, setSensitiveUI: () => {}, triggerProtectionFlash: () => {} }}>
      {children}
    </SecurityContext.Provider>
  );
};

// SecurityLayer is now a clean no-op component for buttery-smooth browsing with zero lag
export const SecurityLayer: React.FC = () => {
  return null;
};

