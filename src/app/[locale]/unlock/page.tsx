import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { isLocale } from '@/i18n/config';
import { LanguageToggle } from '@/components/LanguageToggle';
import { UnlockForm } from '@/components/UnlockForm';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'Unlock' });
  return {
    title: `${t('title')} — Plainvoice`,
    robots: { index: true, follow: true },
    alternates: { canonical: `/${locale}/unlock` },
  };
}

export default async function UnlockPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('Unlock');
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

      <main className="mx-auto w-full max-w-md flex-1 px-6 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-2 text-base text-[color:var(--muted-foreground)]">{t('body')}</p>

        <div className="mt-8">
          <UnlockForm locale={locale} />
        </div>

        <p className="mt-8">
          <Link href={`/${locale}`} className="text-sm underline-offset-4 hover:underline">
            ← {t('back')}
          </Link>
        </p>
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
