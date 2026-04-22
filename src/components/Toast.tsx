'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type ToastVariant = 'info' | 'success' | 'warning' | 'error';

type ToastPayload = {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
};

type ShowToast = (input: { title: string; description?: string; variant?: ToastVariant }) => void;

const ToastContext = createContext<ShowToast | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastPayload[]>([]);
  const idRef = useRef(0);

  const showToast = useCallback<ShowToast>(({ title, description, variant = 'info' }) => {
    idRef.current += 1;
    const id = idRef.current;
    setToasts((prev) => [...prev, { id, title, description, variant }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-6 flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ShowToast {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

function ToastItem({ toast }: { toast: ToastPayload }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div
      role="status"
      className={cn(
        'pointer-events-auto max-w-sm rounded-lg border bg-[color:var(--background)] px-4 py-3 shadow-lg transition-all duration-200',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
        toast.variant === 'info' && 'border-[color:var(--border)]',
        toast.variant === 'success' && 'border-green-300',
        toast.variant === 'warning' && 'border-amber-300',
        toast.variant === 'error' && 'border-red-300',
      )}
    >
      <p className="text-sm font-semibold">{toast.title}</p>
      {toast.description ? (
        <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">{toast.description}</p>
      ) : null}
    </div>
  );
}
