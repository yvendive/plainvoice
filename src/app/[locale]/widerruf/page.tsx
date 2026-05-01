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
  const t = await getTranslations({ locale: 'de', namespace: 'Widerruf' });
  return {
    title: `${t('title')} — Plainvoice`,
    robots: { index: true, follow: true },
    alternates: { canonical: '/de/widerruf' },
  };
}

export default async function WiderrufPage({
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
  const t = await getTranslations({ locale: 'de', namespace: 'Widerruf' });
  const tApp = await getTranslations('App');
  const tf = await getTranslations('Footer');

  const lastUpdated = LEGAL_LAST_UPDATED;

  const mailtoSubject = encodeURIComponent(t('mailtoSubject'));
  const mailtoHref = `mailto:info@plain-cards.com?subject=${mailtoSubject}`;

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
          {/* A. Widerrufsbelehrung */}
          <h2 className="text-xl font-semibold text-[color:var(--foreground)]">{t('sectionAHeading')}</h2>

          <section>
            <h3 className="mb-2 text-lg font-semibold text-[color:var(--foreground)]">{t('introHeading')}</h3>
            <div className="space-y-3">{renderParagraphs(t('introBody'))}</div>
          </section>

          <section>
            <h3 className="mb-2 text-lg font-semibold text-[color:var(--foreground)]">{t('rightHeading')}</h3>
            <div className="space-y-3">{renderParagraphs(t('rightBody'))}</div>
          </section>

          <section>
            <h3 className="mb-2 text-lg font-semibold text-[color:var(--foreground)]">{t('consequencesHeading')}</h3>
            <div className="space-y-3">{renderParagraphs(t('consequencesBody'))}</div>
          </section>

          <section>
            <h3 className="mb-2 text-lg font-semibold text-[color:var(--foreground)]">{t('expiryHeading')}</h3>
            <div className="space-y-3">{renderParagraphs(t('expiryBody'))}</div>
          </section>

          {/* Divider */}
          <hr className="border-[color:var(--border)]" />

          {/* B. Muster-Widerrufsformular */}
          <h2 className="text-xl font-semibold text-[color:var(--foreground)]">{t('sectionBHeading')}</h2>

          <section className="space-y-4">
            <p>{t('formIntro')}</p>
            <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--muted)] p-6 space-y-4">
              <div className="space-y-3">{renderParagraphs(t('formAddressee'))}</div>
              <div className="space-y-3 font-mono text-sm">{renderParagraphs(t('formBody'))}</div>
            </div>
            <p className="text-sm italic">{t('formFootnote')}</p>
          </section>

          {/* Mailto button */}
          <div className="pt-2">
            <a
              href={mailtoHref}
              className="inline-block rounded-md bg-[color:var(--accent)] px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              {t('mailtoButton')}
            </a>
          </div>
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
