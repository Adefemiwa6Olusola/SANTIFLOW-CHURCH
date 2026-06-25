import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';

// Global safeguard for handling new deployment asset shifts (automatic cache invalidation)
window.addEventListener('vite:preloadError', (event) => {
  console.warn('[SanctiFlow OS] Detected preload/asset chunk load failure. Reloading app to pull latest version...');
  window.location.reload();
});

window.addEventListener('error', (e) => {
  if (e.message && (e.message.includes('Loading chunk') || e.message.includes('loading css'))) {
    console.warn('[SanctiFlow OS] Script/CSS chunk error intercepted. Forcing browser hard reload...');
    window.location.reload();
  }
}, true);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
