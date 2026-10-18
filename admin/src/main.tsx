/* Stockly owner console — standalone admin frontend entry.
 *
 * Talks ONLY to the shared backend (/api/admin for users/roles/settings/
 * logs, /api/devices for linked-device management). It never touches the
 * private admin spreadsheet directly — every action is validated
 * server-side by the backend on each call.
 */

import { StrictMode, useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import AdminScreen from './admin/AdminScreen';
import { Toasts } from './components/ui';
import type { ToastMsg } from './shared/types';

let toastId = 1;

function AdminApp() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);
  const notify = useCallback((text: string, kind: 'success' | 'error' | 'info' = 'info') => {
    const id = toastId++;
    setToasts((list) => [...list.slice(-3), { id, kind, text }]);
    window.setTimeout(() => dismiss(id), 4000);
  }, [dismiss]);

  return (
    <div className="min-h-dvh bg-(--bg) text-(--ink)">
      <div className="ambient" aria-hidden="true" />
      <AdminScreen notify={notify} />
      <Toasts toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AdminApp />
  </StrictMode>,
);
