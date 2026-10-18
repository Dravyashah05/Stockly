import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@stockly/ui/styles.css';
import './site/site.css';
import StoreSite from './site/StoreSite';
import WebApp from './web/WebApp';
import AdminScreen from './admin/AdminScreen';

/* Website entry — single bundle with client-side hash routing:
 *   #/        Marketing landing page (StoreSite)
 *   #/app     The dedicated Web Inventory Application (dashboard, products, history, devices, settings)
 *   #/admin   Owner / Administrator Console
 *   store.html Dedicated App Store APK download and installation page
 */

function WebsiteRouter() {
  const [hash, setHash] = useState(() => window.location.hash);

  useEffect(() => {
    const handleHash = () => setHash(window.location.hash);
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  if (hash.startsWith('#/admin')) {
    return (
      <AdminScreen
        onBack={() => {
          window.location.hash = '#/app';
        }}
        notify={(msg) => {
          console.info(`[admin] ${msg}`);
        }}
      />
    );
  }

  if (hash.startsWith('#/app')) {
    return (
      <WebApp
        onNavigateAdmin={() => {
          window.location.hash = '#/admin';
        }}
      />
    );
  }

  return <StoreSite />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WebsiteRouter />
  </StrictMode>,
);
