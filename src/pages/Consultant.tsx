
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * DEPRECATED: Voice Consultation feature has been removed.
 * This component acts as a redirect in case of legacy link access.
 */
export const Consultant: React.FC = () => {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/', { replace: true });
  }, [navigate]);
  return null;
};
