import { describe, expect, it } from 'vitest';
import sitemap from '@/app/sitemap';

describe('sitemap', () => {
  it('returns exactly eight entries', () => {
    const entries = sitemap();
    expect(entries).toHaveLength(8);
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

  it('home pages have higher priority than legal pages', () => {
    const entries = sitemap();
    const de = entries.find((e) => e.url === 'https://plainvoice.de/de')!;
    const ds = entries.find((e) => e.url === 'https://plainvoice.de/de/datenschutz')!;
    const imp = entries.find((e) => e.url === 'https://plainvoice.de/de/impressum')!;
    const agb = entries.find((e) => e.url === 'https://plainvoice.de/de/agb')!;
    expect(de.priority).toBeGreaterThan(ds.priority!);
    expect(de.priority).toBeGreaterThan(imp.priority!);
    expect(de.priority).toBeGreaterThan(agb.priority!);
  });
});
