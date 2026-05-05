const BASE_URL = 'https://plainvoice.de';

/**
 * Standard hreflang alternate URLs for a page that exists in both locales.
 * @param slug - path without locale prefix, e.g. '/buy'
 */
export function pageAlternates(slug: string) {
  return {
    languages: {
      de: `/de${slug}`,
      en: `/en${slug}`,
      'x-default': `/de${slug}`,
    },
  };
}

/**
 * Hreflang alternates for a DE-only page where all locale routes share
 * a single canonical path (e.g. /de/widerruf).
 */
export function deOnlyAlternates(canonicalPath: string) {
  return {
    languages: {
      de: canonicalPath,
      en: canonicalPath,
      'x-default': canonicalPath,
    },
  };
}

/**
 * Standard per-page OpenGraph block. Overrides the layout-level defaults
 * with the page-specific url, title, locale, and (optionally) description.
 */
export function pageOpenGraph(opts: {
  locale: string;
  path: string;
  title: string;
  description?: string;
}) {
  return {
    title: opts.title,
    ...(opts.description ? { description: opts.description } : {}),
    url: `${BASE_URL}${opts.path}`,
    siteName: 'Plainvoice',
    locale: opts.locale === 'de' ? 'de_DE' : 'en_GB',
    type: 'website' as const,
    images: [{ url: '/og.png', width: 1200, height: 630, alt: opts.title }],
  };
}

/**
 * Standard per-page Twitter card block.
 */
export function pageTwitter(opts: { title: string; description?: string }) {
  return {
    card: 'summary_large_image' as const,
    title: opts.title,
    ...(opts.description ? { description: opts.description } : {}),
    images: ['/og.png'],
  };
}
