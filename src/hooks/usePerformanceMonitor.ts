import { useEffect, useRef } from 'react';

export const usePerformanceMonitor = (componentName: string, isLoading?: boolean) => {
  const mountTime = useRef(performance.now());
  const hasLoggedLoad = useRef(false);

  useEffect(() => {
    const timeToMount = performance.now() - mountTime.current;
    console.log(`⏱️ [Performance] ${componentName} mounted in ${timeToMount.toFixed(2)}ms`);
    
    return () => {
      const timeAlive = performance.now() - mountTime.current;
      console.log(`⏱️ [Performance] ${componentName} unmounted after ${timeAlive.toFixed(2)}ms`);
    };
  }, [componentName]);

  useEffect(() => {
    if (isLoading === false && !hasLoggedLoad.current) {
      const timeToLoad = performance.now() - mountTime.current;
      console.log(`🚀 [Performance] ${componentName} finished loading data in ${timeToLoad.toFixed(2)}ms`);
      hasLoggedLoad.current = true;
    } else if (isLoading === true) {
      // Reset if it starts loading again (e.g. navigation)
      hasLoggedLoad.current = false;
      mountTime.current = performance.now();
    }
  }, [isLoading, componentName]);
};
