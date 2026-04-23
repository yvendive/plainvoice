import { describe, expect, it } from 'vitest';
import sitemap from '@/app/sitemap';

describe('sitemap', () => {
  it('returns exactly four entries', () => {
    const entries = sitemap();
    expect(entries).toHaveLength(4);
  });

  it('contains the expected URLs', () => {
    const urls = sitemap().map((e) => e.url);
    expect(urls).toContain('https://plainvoice.de/de');
    expect(urls).toContain('https://plainvoice.de/en');
    expect(urls).toContain('https://plainvoice.de/de/datenschutz');
    expect(urls).toContain('https://plainvoice.de/en/datenschutz');
  });

  it('home pages have higher priority than datenschutz', () => {
    const entries = sitemap();
    const de = entries.find((e) => e.url === 'https://plainvoice.de/de')!;
    const ds = entries.find((e) => e.url === 'https://plainvoice.de/de/datenschutz')!;
    expect(de.priority).toBeGreaterThan(ds.priority!);
  });
});
