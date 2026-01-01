
import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';

// Explicitly disable browser's scroll restoration before any rendering happens
if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

/**
 * Service Worker Registration
 * Resilient to origin mismatches in sandbox environments and 
 * avoids 'Invalid URL' crashes by using defensive checks.
 */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    try {
      // Check if we are in a context where SW is likely to succeed
      // (Secure origin or localhost)
      const isLocalhost = Boolean(
        window.location.hostname === 'localhost' ||
        window.location.hostname === '[::1]' ||
        window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
      );

      const isSecure = window.location.protocol === 'https:';

      if (isSecure || isLocalhost) {
        // We use a relative path. The browser will resolve it.
        // We catch errors to prevent the entire app from crashing if registration fails.
        navigator.serviceWorker
          .register('./sw.js')
          .then((registration) => {
            console.debug('SW registered successfully:', registration.scope);
          })
          .catch((err) => {
            // Silently fail or log a warning if SW is blocked by origin/security policy
            console.warn('SW registration bypassed or failed: ', err.message);
          });
      }
    } catch (e) {
      // Absolute safety: ensure no error in this block crashes the main thread
      console.error('Service Worker initialization error skipped:', e);
    }
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);
