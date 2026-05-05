import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn().mockImplementation(async (nsOrOpts: string | { namespace: string }) => {
    const ns = typeof nsOrOpts === 'string' ? nsOrOpts : (nsOrOpts as { namespace: string }).namespace;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t: any = (key: string) => `${ns}.${key}`;
    // Stub t.rich so pages that use rich-text interpolation don't throw
    t.rich = (key: string) => `${ns}.${key}`;
    return t;
  }),
  setRequestLocale: vi.fn(),
}));

vi.mock('next/navigation', () => ({ notFound: vi.fn() }));

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement('a', { href, className }, children),
}));

vi.mock('@/components/Converter', () => ({ Converter: () => null }));
vi.mock('@/components/LanguageToggle', () => ({ LanguageToggle: () => null }));
vi.mock('@/components/BuyForm', () => ({ BuyForm: () => null }));
vi.mock('@/components/UnlockForm', () => ({ UnlockForm: () => null }));

// ── Page imports ──────────────────────────────────────────────────────────────
const { default: LandingPage }    = await import('@/app/[locale]/page');
const { default: BuyPage }        = await import('@/app/[locale]/buy/page');
const { default: UnlockPage }     = await import('@/app/[locale]/unlock/page');
const { default: UnlockedPage }   = await import('@/app/[locale]/unlocked/page');
const { default: AgbPage }        = await import('@/app/[locale]/agb/page');
const { default: DatenschutzPage }= await import('@/app/[locale]/datenschutz/page');
const { default: ImpressumPage }  = await import('@/app/[locale]/impressum/page');
const { default: WiderrufPage }   = await import('@/app/[locale]/widerruf/page');

// ── Existing landing-page footer tests ───────────────────────────────────────
describe('footer-links on landing page', () => {
  for (const locale of ['de', 'en'] as const) {
    it(`/${locale} footer contains impressum link`, async () => {
      const jsx = await LandingPage({ params: Promise.resolve({ locale }) });
      const html = renderToStaticMarkup(jsx as React.ReactElement);
      expect(html).toContain(`/${locale}/impressum`);
    });

    it(`/${locale} footer contains agb link`, async () => {
      const jsx = await LandingPage({ params: Promise.resolve({ locale }) });
      const html = renderToStaticMarkup(jsx as React.ReactElement);
      expect(html).toContain(`/${locale}/agb`);
    });

    it(`/${locale} footer contains datenschutz link`, async () => {
      const jsx = await LandingPage({ params: Promise.resolve({ locale }) });
      const html = renderToStaticMarkup(jsx as React.ReactElement);
      expect(html).toContain(`/${locale}/datenschutz`);
    });
  }
});

// ── /de/widerruf must be present in every page footer ────────────────────────
type PageComponent = (props: { params: Promise<{ locale: string }> }) => Promise<React.ReactNode>;

const ALL_PAGES: Array<{ name: string; Page: PageComponent }> = [
  { name: 'LandingPage',     Page: LandingPage     as PageComponent },
  { name: 'BuyPage',         Page: BuyPage         as PageComponent },
  { name: 'UnlockPage',      Page: UnlockPage      as PageComponent },
  { name: 'UnlockedPage',    Page: UnlockedPage    as PageComponent },
  { name: 'AgbPage',         Page: AgbPage         as PageComponent },
  { name: 'DatenschutzPage', Page: DatenschutzPage as PageComponent },
  { name: 'ImpressumPage',   Page: ImpressumPage   as PageComponent },
  { name: 'WiderrufPage',    Page: WiderrufPage    as PageComponent },
];

describe('Widerrufsbelehrung footer link — all pages', () => {
  for (const { name, Page } of ALL_PAGES) {
    for (const locale of ['de', 'en'] as const) {
      it(`${name} /${locale} footer contains /de/widerruf`, async () => {
        const jsx = await Page({ params: Promise.resolve({ locale }) });
        const html = renderToStaticMarkup(jsx as React.ReactElement);
        expect(html).toContain('/de/widerruf');
      });
    }
  }
});
