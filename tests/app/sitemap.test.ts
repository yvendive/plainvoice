import { describe, expect, it } from 'vitest';
import sitemap from '@/app/sitemap';

describe('sitemap', () => {
  it('returns exactly twelve entries', () => {
    const entries = sitemap();
    expect(entries).toHaveLength(12);
  });

  it('contains the home page URLs', () => {
    const urls = sitemap().map((e) => e.url);
    expect(urls).toContain('https://plainvoice.de/de');
    expect(urls).toContain('https://plainvoice.de/en');
  });

  it('contains the datenschutz URLs', () => {
    const urls = sitemap().map((e) => e.url);
    expect(urls).toContain('https://plainvoice.de/de/datenschutz');
    expect(urls).toContain('https://plainvoice.de/en/datenschutz');
  });

  it('contains the impressum URLs', () => {
    const urls = sitemap().map((e) => e.url);
    expect(urls).toContain('https://plainvoice.de/de/impressum');
    expect(urls).toContain('https://plainvoice.de/en/impressum');
  });

  it('contains the agb URLs', () => {
    const urls = sitemap().map((e) => e.url);
    expect(urls).toContain('https://plainvoice.de/de/agb');
    expect(urls).toContain('https://plainvoice.de/en/agb');
  });

  it('contains the buy URLs', () => {
    const urls = sitemap().map((e) => e.url);
    expect(urls).toContain('https://plainvoice.de/de/buy');
    expect(urls).toContain('https://plainvoice.de/en/buy');
  });

  it('contains the unlock URLs', () => {
    const urls = sitemap().map((e) => e.url);
    expect(urls).toContain('https://plainvoice.de/de/unlock');
    expect(urls).toContain('https://plainvoice.de/en/unlock');
  });

  it('does NOT contain /unlocked (transactional, noindex)', () => {
    const urls = sitemap().map((e) => e.url);
    expect(urls.some((u) => u.includes('/unlocked'))).toBe(false);
  });

  it('home pages have higher priority than legal/commerce pages', () => {
    const entries = sitemap();
    const de = entries.find((e) => e.url === 'https://plainvoice.de/de')!;
    const buy = entries.find((e) => e.url === 'https://plainvoice.de/de/buy')!;
    const ds = entries.find((e) => e.url === 'https://plainvoice.de/de/datenschutz')!;
    expect(de.priority).toBeGreaterThan(buy.priority!);
    expect(de.priority).toBeGreaterThan(ds.priority!);
  });
});
