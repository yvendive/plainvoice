import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { locales, isLocale, type Locale } from '@/i18n/config';
import { HtmlLangSetter } from '@/components/HtmlLangSetter';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

type Params = { locale: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  const baseUrl = 'https://plainvoice.de';
  const path = `/${locale}`;
  return {
    title: t('title'),
    description: t('description'),
    metadataBase: new URL(baseUrl),
    themeColor: '#333F8C',
    alternates: {
      canonical: path,
      languages: {
        de: '/de',
        en: '/en',
        'x-default': '/de',
      },
    },
    openGraph: {
      title: t('title'),
      description: t('description'),
      url: `${baseUrl}${path}`,
      siteName: 'Plainvoice',
      locale: locale === 'de' ? 'de_DE' : 'en_GB',
      type: 'website',
      images: [{ url: '/og.png', width: 1200, height: 630, alt: t('title') }],
    },
    twitter: {
      card: 'summary_large_image',
      title: t('title'),
      description: t('description'),
      images: ['/og.png'],
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<Params>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  setRequestLocale(locale as Locale);
  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <HtmlLangSetter locale={locale} />
      {children}
    </NextIntlClientProvider>
  );
}
