'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { isPro } from '@/lib/entitlement';
import { Button } from '@/components/ui/button';

interface ProGateProps {
  children: React.ReactNode;
}

const PAYWALL_LIVE = process.env.NEXT_PUBLIC_PAYWALL_LIVE === 'true';

export function ProGate({ children }: ProGateProps) {
  const [unlocked, setUnlocked] = useState(false);
  const [mounted, setMounted] = useState(false);
  const t = useTranslations('ProGate');
  const params = useParams();
  const locale = (params?.locale as string) ?? 'de';

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
      {PAYWALL_LIVE ? (
        <Link
          href={`/${locale}/buy`}
          className="inline-flex h-10 items-center justify-center rounded-md bg-[color:var(--accent)] px-6 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          {t('cta')}
        </Link>
      ) : (
        <Button size="lg" disabled>{t('ctaComingSoon')}</Button>
      )}
      <p className="text-xs text-[color:var(--muted-foreground)]">{t('availabilityHint')}</p>
    </div>
  );
}
