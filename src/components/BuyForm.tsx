'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

interface BuyFormProps {
  locale: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? '';

export function BuyForm({ locale }: BuyFormProps) {
  const t = useTranslations('Buy');
  const tf = useTranslations('Footer');

  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);

  const emailValid = EMAIL_RE.test(email);
  const disabled = !emailValid || !consent || submitting;

  const showEmailError = emailTouched && !emailValid && email.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled) return;
    setSubmitting(true);
    setError(null);
    const consentTimestamp = new Date().toISOString();
    try {
      const res = await fetch(`${WORKER_URL}/api/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, locale, consentWaiver: true, consentTimestamp }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    } catch {
      setError(t('errorGeneric'));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex w-full flex-col gap-6">
      {/* Price box */}
      <div className="rounded-xl border bg-[color:var(--muted)] p-6 text-center">
        <p className="text-4xl font-semibold tracking-tight">{t('priceAmount')}</p>
        <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{t('priceCadence')}</p>
        <p className="text-xs text-[color:var(--muted-foreground)]">{t('priceVat')}</p>
      </div>

      {/* Email */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="buy-email" className="text-sm font-medium">
          {t('emailLabel')}
        </label>
        <input
          id="buy-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setEmailTouched(true)}
          placeholder={t('emailPlaceholder')}
          aria-invalid={showEmailError}
          aria-describedby={showEmailError ? 'buy-email-error' : undefined}
          className="rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm outline-none ring-0 focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent)]/20"
        />
        {showEmailError && (
          <p id="buy-email-error" role="alert" className="text-xs text-red-500">
            {t('emailInvalid')}
          </p>
        )}
      </div>

      {/* Consent checkbox */}
      <label className="flex cursor-pointer items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-[color:var(--border)] accent-[color:var(--accent)]"
        />
        <span className="text-[color:var(--muted-foreground)]">{t('consentLabel')}</span>
      </label>

      {/* Legal links near checkbox */}
      <p className="text-xs text-[color:var(--muted-foreground)]">
        <Link href={`/${locale}/agb`} className="underline underline-offset-4 hover:opacity-80">
          {tf('termsLink')}
        </Link>
        {' · '}
        <Link href="/de/widerruf" className="underline underline-offset-4 hover:opacity-80">
          {t('widerrufLink')}
        </Link>
        {' · '}
        <Link href={`/${locale}/datenschutz`} className="underline underline-offset-4 hover:opacity-80">
          {tf('privacyLink')}
        </Link>
        {' · '}
        <Link href={`/${locale}/impressum`} className="underline underline-offset-4 hover:opacity-80">
          {tf('impressumLink')}
        </Link>
      </p>

      {/* Error message */}
      {error && (
        <p role="alert" className="text-sm text-red-500">
          {error}
        </p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={disabled}
        aria-disabled={disabled}
        className="rounded-md bg-[color:var(--accent)] px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? '…' : t('buyButton')}
      </button>
    </form>
  );
}
