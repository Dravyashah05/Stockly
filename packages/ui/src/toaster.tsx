import { useSyncExternalStore } from 'react';
import { IconAlertTriangle, IconCheck, IconClose } from './icons.tsx';
import { dismissWithSlide, toastStore } from './toast-state.ts';
import type { ToastItem } from './toast-state.ts';

export type ToasterProps = {
  /** Where the stack appears. Default: 'bottom'. */
  placement?: 'top' | 'bottom';
  /** Accessible name for the dismiss buttons. Default: 'Dismiss'. */
  dismissLabel?: string;
};

/**
 * Mounted once near the root of your app (portal to `document.body`):
 *
 * ```tsx
 * createRoot(root).render(<App><Toaster />…</App>);
 * ```
 */
export function Toaster({ placement = 'bottom', dismissLabel = 'Dismiss' }: ToasterProps) {
  const items = useSyncExternalStore(toastStore.subscribe, toastStore.getSnapshot, toastStore.getSnapshot);
  if (items.length === 0) return null;
  return (
    <div className="stk-toaster" data-placement={placement} role="status" aria-live="polite">
      {items.map((toast: ToastItem) => (
        <div
          key={toast.id}
          className="stk-toast"
          data-kind={toast.kind ?? 'info'}
          data-stk-toast-id={toast.id}
          data-stk-state={toast.dismissing ? 'leaving' : 'open'}
        >
          <span className="stk-toast__icon" aria-hidden="true">
            {toast.kind === 'success' ? <IconCheck /> : toast.kind === 'error' ? <IconAlertTriangle /> : null}
          </span>
          <span className="stk-toast__main">
            <span className="stk-toast__message">{toast.message}</span>
            <button
              type="button"
              className="stk-icon-button stk-toast__dismiss"
              aria-label={toast.dismissLabel ?? dismissLabel}
              onClick={() => dismissWithSlide(toast.id)}
            >
              <IconClose />
            </button>
          </span>
          {toast.action ? (
            <button
              type="button"
              className="stk-toast__action"
              onClick={() => {
                toast.action?.onClick();
                dismissWithSlide(toast.id);
              }}
            >
              {toast.action.label}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
