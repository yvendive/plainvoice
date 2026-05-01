import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { isLocale } from '@/i18n/config';
import { LanguageToggle } from '@/components/LanguageToggle';
import { COMPANY } from '@/lib/legal/company';
import { pageAlternates, pageOpenGraph, pageTwitter } from '@/lib/seo/metadata';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'Impressum' });
  const title = `${t('title')} — Plainvoice`;
  return {
    title,
    robots: { index: true, follow: true },
    alternates: { canonical: `/${locale}/impressum`, ...pageAlternates('/impressum') },
    openGraph: pageOpenGraph({ locale, path: `/${locale}/impressum`, title }),
    twitter: pageTwitter({ title }),
  };
}

export default async function ImpressumPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('Impressum');
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

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>

        <div className="mt-8 space-y-8 text-base leading-relaxed text-[color:var(--muted-foreground)]">
          <section>
            <h2 className="mb-2 text-lg font-semibold text-[color:var(--foreground)]">{t('section1Heading')}</h2>
            <p>{t('legalName')}</p>
            <p>{t('legalForm')}</p>
            <p>{t('address')}</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-[color:var(--foreground)]">{t('section2Heading')}</h2>
            <p>{t('director')}</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-[color:var(--foreground)]">{t('section3Heading')}</h2>
            <p>
              {t('emailLabel')}{' '}
              <a href={`mailto:${COMPANY.email}`} className="underline underline-offset-4 hover:opacity-80">
                {COMPANY.email}
              </a>
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-[color:var(--foreground)]">{t('section4Heading')}</h2>
            <p>{t('register')}</p>
            <p>{t('registerAuthority')}</p>
            <p>{t('registerNumber')}</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-[color:var(--foreground)]">{t('section5Heading')}</h2>
            <p>{t('vatLabel')} {COMPANY.vatId}</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-[color:var(--foreground)]">{t('section6Heading')}</h2>
            <p>{t('odrIntro')}</p>
            <p>
              <a
                href={t('odrLink')}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:opacity-80"
              >
                {t('odrLink')}
              </a>
            </p>
            <p className="mt-2">{t('vsbgOptOut')}</p>
          </section>
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
