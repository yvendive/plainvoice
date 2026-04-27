'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { isPro } from '@/lib/pro/entitlement';
import { Button } from '@/components/ui/button';

interface ProGateProps {
  children: React.ReactNode;
}

export function ProGate({ children }: ProGateProps) {
  const [unlocked, setUnlocked] = useState(false);
  const [mounted, setMounted] = useState(false);
  const t = useTranslations('ProGate');

  useEffect(() => {
    setUnlocked(isPro());
    setMounted(true);
  }, []);

  if (!mounted) return null;

  if (unlocked) return <>{children}</>;

  return (
    <div
      role="region"
      aria-label={t('title')}
      className="flex w-full flex-col items-center gap-3 rounded-xl border bg-[color:var(--muted)] p-6 text-center"
    >
      <h3 className="text-lg font-semibold">{t('title')}</h3>
      <p className="text-sm text-[color:var(--muted-foreground)]">{t('body')}</p>
      <p className="text-2xl font-semibold tracking-tight">{t('price')}</p>
      <Button size="lg" disabled>{t('ctaComingSoon')}</Button>
      <p className="text-xs text-[color:var(--muted-foreground)]">{t('availabilityHint')}</p>
    </div>
  );
}
