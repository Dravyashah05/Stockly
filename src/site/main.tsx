import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './site.css';
import StoreSite from './StoreSite';

createRoot(document.getElementById('site-root')!).render(
  <StrictMode>
    <StoreSite />
  </StrictMode>,
);
