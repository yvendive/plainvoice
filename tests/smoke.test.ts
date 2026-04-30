import { describe, expect, it } from 'vitest';
import { defaultLocale, isLocale, locales, localeStorageKey } from '@/i18n/config';

describe('i18n config (M1 smoke)', () => {
  it('defines the expected locales', () => {
    expect(locales).toEqual(['de', 'en']);
  });

  it('defaults to German', () => {
    expect(defaultLocale).toBe('de');
  });

  it('uses the documented localStorage key', () => {
    expect(localeStorageKey).toBe('xrc.lang');
  });

  it('isLocale accepts known locales and rejects others', () => {
    expect(isLocale('de')).toBe(true);
    expect(isLocale('en')).toBe(true);
    expect(isLocale('fr')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale(42)).toBe(false);
  });
});

describe('i18n message catalogs', () => {
  it.each(locales)('loads %s messages and contains required namespaces', async (locale) => {
    const messages = (await import(`@/i18n/messages/${locale}.json`)).default as Record<
      string,
      Record<string, string>
    >;
    expect(messages.App.title).toBe('Plainvoice');
    expect(messages.Converter.privacy).toBeTruthy();
    expect(messages.Footer.privacyLink).toBeTruthy();
    // Legal namespaces (Privacy, Agb, Widerruf) are DE-only
    if (locale === 'de') {
      expect(messages.Privacy.title).toBeTruthy();
    }
  });
});
