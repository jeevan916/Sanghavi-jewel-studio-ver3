
import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';

// Explicitly disable browser's scroll restoration before any rendering happens
if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

// Relative path registration for PWA functionality with origin check
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Only attempt registration if we are on the same origin to avoid sandbox errors
    const swUrl = new URL('./sw.js', window.location.href);
    if (swUrl.origin === window.location.origin) {
      navigator.serviceWorker.register('./sw.js').catch(err => {
        console.warn('SW registration bypassed or failed: ', err.message);
      });
    } else {
      console.debug('SW registration skipped: Origin mismatch in sandbox environment.');
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
