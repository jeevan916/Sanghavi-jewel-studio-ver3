
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * DEPRECATED: Generic Login has been replaced by CustomerLogin and StaffLogin.
 * This file serves as a routing gateway to prevent "Login history" elements 
 * from surfacing in the app.
 */
export const Login: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to the appropriate portal immediately
    navigate('/login', { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center">
      <div className="animate-pulse font-serif text-stone-400">Sanghavi Studio Gateway...</div>
    </div>
  );
};
