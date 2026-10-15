import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { StoreProvider } from './shared/store';
import Website from './website';
import './website.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode><StoreProvider><Website /></StoreProvider></StrictMode>,
);
