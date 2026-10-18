import { useCallback, useEffect, useRef } from 'react';

/**
 * Toast data model + store. Kept framework-view-free so that `useToast` (a hook)
 * does not live in the same module as the `<Toaster />` component.
 */
export type ToastKind = 'info' | 'success' | 'error';

export type ToastAction = {
  label: string;
  onClick: () => void;
};

export type ToastOptions = {
  kind?: ToastKind;
  /** Auto-dismiss delay in ms. `0` keeps the toast until dismissed. Default: 4000, errors: 6000. */
  duration?: number;
  action?: ToastAction;
  dismissLabel?: string;
};

export type ToastItem = ToastOptions & {
  id: string;
  message: string;
  dismissing?: boolean;
};

let items: ToastItem[] = [];
const listeners = new Set<() => void>();
/** At most three toasts are visible at once; older ones are dropped. */
const MAX_TOASTS = 3;
let seq = 0;

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): readonly ToastItem[] {
  return items;
}

function removeInternal(id: string): void {
  if (!items.some((item) => item.id === id)) return;
  items = items.filter((item) => item.id !== id);
  emit();
}

/**
 * Queue a toast from anywhere (event handlers, stores, effects). Returns the id
 * so the caller can dismiss it early.
 */
export function toastSequence(message: string, options?: ToastOptions): string {
  const id = `toast-${++seq}`;
  items = [...items, { ...options, id, message }].slice(-MAX_TOASTS);
  emit();
  return id;
}

export type UseToastOptions = Omit<ToastOptions, 'action'> & {
  /** `onClick` is optional here — hooks wire it to an async call you can await. */
  action?: Omit<ToastAction, 'onClick'> & { onClick?: () => void };
};

export type UseToastController = {
  show: (message: string, options?: UseToastOptions) => string;
  success: (message: string, options?: Omit<UseToastOptions, 'kind'>) => string;
  error: (message: string, options?: Omit<UseToastOptions, 'kind'>) => string;
  dismiss: (id: string) => void;
};

/**
 * Imperative toast controller.
 *
 * ```tsx
 * const toast = useToast();
 * await save();                        // throws
 * toast.error('Could not save item');  // from anywhere below
 * ```
 */
export function useToast(): UseToastController {
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  const show = useCallback((message: string, options?: UseToastOptions): string => {
    const { action, ...rest } = options ?? {};
    const resolvedAction: ToastAction | undefined =
      action && action.onClick ? { label: action.label, onClick: action.onClick } : undefined;
    const kind = rest.kind ?? 'info';
    const id = toastSequence(message, { ...rest, kind, action: resolvedAction });

    const duration = rest.duration ?? (kind === 'error' ? 6000 : 4000);
    if (duration > 0) {
      const timer = setTimeout(() => {
        timers.current.delete(id);
        dismissWithSlide(id);
      }, duration);
      timers.current.set(id, timer);
    }
    return id;
  }, []);

  const dismiss = useCallback((id: string): void => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    dismissWithSlide(id);
  }, []);

  return {
    show,
    success: (message, options) => show(message, { ...options, kind: 'success' }),
    error: (message, options) => show(message, { ...options, kind: 'error' }),
    dismiss,
  };
}

/**
 * Play the leaving animation, then actually remove the item. This mirrors the
 * other overlays in the package: the exit transition runs, state updates after.
 */
export function dismissWithSlide(id: string): void {
  const target = items.find((item) => item.id === id);
  if (!target || target.dismissing) return;
  items = items.map((item) => (item.id === id ? { ...item, dismissing: true } : item));
  emit();
  if (typeof document === 'undefined') {
    removeInternal(id);
    return;
  }
  const element = document.querySelector<HTMLElement>(`[data-stk-toast-id="${CSS.escape(id)}"]`);
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  if (!element || reduced) {
    removeInternal(id);
    return;
  }
  let done = false;
  const finish = (): void => {
    if (done) return;
    done = true;
    element.removeEventListener('transitionend', finish);
    removeInternal(id);
  };
  element.addEventListener('transitionend', finish);
  requestAnimationFrame(() => {
    element.dataset.stkState = 'leaving';
  });
  setTimeout(finish, 400);
}

/** Subscribe used by `<Toaster />` — exported for completeness. */
export const toastStore = { subscribe, getSnapshot };
