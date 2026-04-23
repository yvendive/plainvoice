import { describe, expect, it, vi } from 'vitest';

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => `[${key}]`),
  setRequestLocale: vi.fn(),
  getMessages: vi.fn().mockResolvedValue({}),
}));

// Import after mock is set up
const { generateMetadata } = await import('@/app/[locale]/layout');

describe('generateMetadata', () => {
  it('returns empty object for unknown locale', async () => {
    const result = await generateMetadata({ params: Promise.resolve({ locale: 'fr' }) });
    expect(result).toEqual({});
  });

  it('sets openGraph image to /og.png at 1200×630', async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ locale: 'de' }) });
    const img = (meta.openGraph?.images as { url: string; width: number; height: number }[])[0];
    expect(img.url).toBe('/og.png');
    expect(img.width).toBe(1200);
    expect(img.height).toBe(630);
  });

  it('sets canonical to /<locale> path', async () => {
    const de = await generateMetadata({ params: Promise.resolve({ locale: 'de' }) });
    expect(de.alternates?.canonical).toBe('/de');

    const en = await generateMetadata({ params: Promise.resolve({ locale: 'en' }) });
    expect(en.alternates?.canonical).toBe('/en');
  });

  it('sets hreflang alternates for de, en and x-default', async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ locale: 'de' }) });
    const langs = meta.alternates?.languages as Record<string, string>;
    expect(langs.de).toBe('/de');
    expect(langs.en).toBe('/en');
    expect(langs['x-default']).toBe('/de');
  });

  it('sets twitter card to summary_large_image', async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ locale: 'de' }) });
    const twitter = meta.twitter as { card?: string } | undefined;
    expect(twitter?.card).toBe('summary_large_image');
  });

  it('sets themeColor to the Plainvoice accent', async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ locale: 'de' }) });
    expect(meta.themeColor).toBe('#333F8C');
  });
});
