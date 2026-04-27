import Link from 'next/link';
import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import { isLocale, type Locale } from '@/i18n/config';
import { notFound } from 'next/navigation';
import { Converter } from '@/components/Converter';
import { LanguageToggle } from '@/components/LanguageToggle';

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('App');
  const tc = await getTranslations('Converter');
  const tf = await getTranslations('Footer');

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-4 md:px-10">
        <Link href={`/${locale}`} className="text-lg font-semibold tracking-tight">
          {t('title')}
        </Link>
        <LanguageToggle />
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-6 px-6 py-10">
        <div className="text-center">
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">{t('title')}</h1>
          <p className="mt-2 text-base text-[color:var(--muted-foreground)] md:text-lg">
            {t('tagline')}
          </p>
          <p className="mt-6 text-sm text-[color:var(--muted-foreground)] md:text-base">
            {tc('subtitle')}
          </p>
        </div>

        <Converter locale={locale as Locale} />

        <p className="text-center text-sm text-[color:var(--muted-foreground)]">
          {tc('privacy')}
        </p>
      </main>

      <footer className="flex flex-col items-center gap-3 border-t px-6 py-6 text-sm text-[color:var(--muted-foreground)] md:px-10">
        <p className="text-center text-xs md:text-sm">{tf('requirements')}</p>
        <div className="flex w-full flex-col items-center justify-between gap-3 md:flex-row">
          <span>{tf('copyright', { year: new Date().getFullYear() })}</span>
          <nav className="flex gap-4">
            <Link href={`/${locale}/impressum`} className="underline-offset-4 hover:underline">{tf('impressumLink')}</Link>
            <Link href={`/${locale}/agb`} className="underline-offset-4 hover:underline">{tf('termsLink')}</Link>
            <Link href={`/${locale}/datenschutz`} className="underline-offset-4 hover:underline">{tf('privacyLink')}</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
