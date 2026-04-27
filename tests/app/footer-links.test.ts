import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn().mockImplementation(async (nsOrOpts: string | { namespace: string }) => {
    const ns = typeof nsOrOpts === 'string' ? nsOrOpts : nsOrOpts.namespace;
    return (key: string) => `${ns}.${key}`;
  }),
  setRequestLocale: vi.fn(),
}));

vi.mock('next/navigation', () => ({ notFound: vi.fn() }));

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement('a', { href, className }, children),
}));

vi.mock('@/components/Converter', () => ({
  Converter: () => null,
}));

vi.mock('@/components/LanguageToggle', () => ({
  LanguageToggle: () => null,
}));

const { default: LandingPage } = await import('@/app/[locale]/page');

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
