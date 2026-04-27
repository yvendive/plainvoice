'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface UnlockFormProps {
  locale: string;
}

type UnlockState = 'idle' | 'verifying' | 'success' | 'error-invalid' | 'error-network';

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? '';

export function UnlockForm({ locale }: UnlockFormProps) {
  const t = useTranslations('Unlock');
  const router = useRouter();

  const [key, setKey] = useState('');
  const [status, setStatus] = useState<UnlockState>('idle');

  const isWorking = status === 'verifying' || status === 'success';

  async function handleActivate(e: React.FormEvent) {
    e.preventDefault();
    if (isWorking || !key.trim()) return;
    setStatus('verifying');
    try {
      const res = await fetch(`${WORKER_URL}/api/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key.trim() }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const { valid } = (await res.json()) as { valid: boolean };
      if (valid) {
        try {
          localStorage.setItem('plainvoice.pro', '1');
          localStorage.setItem('plainvoice.pro.key', key.trim());
        } catch {
          /* ignore quota / privacy mode */
        }
        setStatus('success');
        setTimeout(() => router.push(`/${locale}`), 2000);
      } else {
        setStatus('error-invalid');
      }
    } catch {
      setStatus('error-network');
    }
  }

  return (
    <form onSubmit={handleActivate} className="flex w-full flex-col gap-4">
      <textarea
        rows={3}
        value={key}
        onChange={(e) => {
          setKey(e.target.value);
          if (status !== 'idle') setStatus('idle');
        }}
        placeholder={t('keyPlaceholder')}
        disabled={isWorking}
        aria-label={t('keyPlaceholder')}
        className="resize-none rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent)]/20 disabled:opacity-60"
      />

      {status === 'error-invalid' && (
        <p role="alert" className="text-sm text-red-500">
          {t('errorInvalid')}
        </p>
      )}
      {status === 'error-network' && (
        <p role="alert" className="text-sm text-red-500">
          {t('errorNetwork')}
        </p>
      )}
      {status === 'success' && (
        <p role="status" className="text-sm text-green-600">
          {t('stateSuccess')}
        </p>
      )}

      <button
        type="submit"
        disabled={isWorking || !key.trim()}
        aria-disabled={isWorking || !key.trim()}
        className="rounded-md bg-[color:var(--accent)] px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {status === 'verifying' ? t('stateVerifying') : t('activateButton')}
      </button>
    </form>
  );
}
