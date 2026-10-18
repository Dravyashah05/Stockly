import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './site/site.css';
import StoreSite from './site/StoreSite';

/* Website entry — one bundle, hash routes:
 *   #/        marketing landing (StoreSite)
 *   #/app     the web inventory application (dashboard, products, …)
 *   #/admin   owner console
 * `store.html` stays a dedicated page (download + install guide).
 * Hash routing works on static hosts without server rewrites. */

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreSite />
  </StrictMode>,
);
