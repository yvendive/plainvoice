import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { isLocale } from '@/i18n/config';
import { LanguageToggle } from '@/components/LanguageToggle';
import { LEGAL_LAST_UPDATED } from '@/lib/legal/company';

function renderParagraphs(text: string) {
  return text.split('\n\n').map((p, i) => (
    <p key={i} className="whitespace-pre-line">{p}</p>
  ));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'Agb' });
  return {
    title: `${t('title')} — Plainvoice`,
    robots: { index: true, follow: true },
    alternates: { canonical: `/${locale}/agb` },
  };
}

export default async function AgbPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  // Legal pages are DE-only — always load German translations regardless
  // of the route locale. EN routes show DE legal text per the locked-decision
  // DE-only-legal scope (docs/handoffs/07-stripe-paywall.md).
  const t = await getTranslations({ locale: 'de', namespace: 'Agb' });
  const tApp = await getTranslations('App');
  const tf = await getTranslations('Footer');

  const lastUpdated = LEGAL_LAST_UPDATED;

  const sections: Array<{ heading: string; body?: string; extra?: React.ReactNode }> = [
    { heading: t('s1Heading'), body: t('s1Body') },
    { heading: t('s2Heading'), body: t('s2Body') },
    { heading: t('s3Heading'), body: t('s3Body') },
    { heading: t('s4Heading'), body: t('s4Body') },
    { heading: t('s5Heading'), body: t('s5Body') },
    { heading: t('s6Heading'), body: t('s6Body') },
    { heading: t('s7Heading'), body: t('s7Body') },
    { heading: t('s8Heading'), body: t('s8Body') },
    { heading: t('s9Heading'), body: t('s9Body') },
    { heading: t('s10Heading'), body: t('s10Body') },
    { heading: t('s11Heading'), body: t('s11Body') },
    { heading: t('s12Heading'), body: t('s12Body') },
    { heading: t('s13Heading'), body: t('s13Body') },
  ];

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
        <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{t('lastUpdated', { date: lastUpdated })}</p>

        <div className="mt-8 space-y-8 text-base leading-relaxed text-[color:var(--muted-foreground)]">
          {sections.map((s, i) => (
            <section key={i}>
              <h2 className="mb-2 text-lg font-semibold text-[color:var(--foreground)]">{s.heading}</h2>
              {s.extra ?? (s.body ? renderParagraphs(s.body) : null)}
            </section>
          ))}
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
        <Link href={`/${locale}/datenschutz`} className="underline-offset-4 hover:underline">{tf('privacyLink')}</Link>
      </footer>
    </div>
  );
}
