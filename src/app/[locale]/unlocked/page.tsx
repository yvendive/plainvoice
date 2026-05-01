import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { isLocale } from '@/i18n/config';
import { LanguageToggle } from '@/components/LanguageToggle';
import { pageAlternates, pageOpenGraph, pageTwitter } from '@/lib/seo/metadata';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const title = 'Plainvoice Pro';
  return {
    title,
    // Exclude from search engines — transactional landing reached via Stripe redirect only.
    robots: { index: false, follow: false },
    alternates: { canonical: `/${locale}/unlocked`, ...pageAlternates('/unlocked') },
    openGraph: pageOpenGraph({ locale, path: `/${locale}/unlocked`, title }),
    twitter: pageTwitter({ title }),
  };
}

export default async function UnlockedPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('Unlocked');
  const tApp = await getTranslations('App');
  const tf = await getTranslations('Footer');

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-4 md:px-10">
        <Link href={`/${locale}`} className="text-lg font-semibold tracking-tight">
          {tApp('title')}
        </Link>
        <LanguageToggle />
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-6 py-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">✓ {t('title')}</h1>
        <p className="mt-4 text-base leading-relaxed text-[color:var(--muted-foreground)]">{t('body')}</p>
        <Link
          href={`/${locale}/unlock`}
          className="mt-8 inline-flex items-center justify-center rounded-md bg-[color:var(--accent)] px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          {t('cta')}
        </Link>
      </main>

      <footer className="flex justify-center gap-4 border-t px-6 py-4 text-sm text-[color:var(--muted-foreground)]">
        <Link href={`/${locale}/impressum`} className="underline-offset-4 hover:underline">{tf('impressumLink')}</Link>
        <Link href={`/${locale}/agb`} className="underline-offset-4 hover:underline">{tf('termsLink')}</Link>
        <Link href="/de/widerruf" className="underline-offset-4 hover:underline">{tf('widerrufLink')}</Link>
        <Link href={`/${locale}/datenschutz`} className="underline-offset-4 hover:underline">{tf('privacyLink')}</Link>
      </footer>
    </div>
  );
}
