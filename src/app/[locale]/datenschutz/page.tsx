import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { isLocale } from '@/i18n/config';
import { LanguageToggle } from '@/components/LanguageToggle';

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('Privacy');
  const tApp = await getTranslations('App');

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
        <div className="mt-6 space-y-4 text-base leading-relaxed text-[color:var(--muted-foreground)]">
          <p>{t('intro')}</p>
          <p>{t('noUpload')}</p>
          <p>{t('noTracking')}</p>
          <p>{t('hosting')}</p>
        </div>
        <p className="mt-8">
          <Link href={`/${locale}`} className="text-sm underline-offset-4 hover:underline">
            ← {t('back')}
          </Link>
        </p>
      </main>
    </div>
  );
}
