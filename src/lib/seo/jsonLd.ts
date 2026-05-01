import { COMPANY } from '@/lib/legal/company';

const BASE_URL = 'https://plainvoice.de';

/** schema.org/SoftwareApplication — home page */
export function softwareApplicationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Plainvoice',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: BASE_URL,
    description:
      'Browser-based converter for German X-Rechnung XML invoices into CSV, TXT, XLSX, or PDF. Conversion runs locally in the browser — no file upload, no server.',
    inLanguage: ['de', 'en'],
    isAccessibleForFree: true,
    license: 'https://opensource.org/licenses/MIT',
    offers: [
      {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'EUR',
        name: 'Free — single-file conversion',
        availability: 'https://schema.org/OnlineOnly',
      },
      {
        '@type': 'Offer',
        price: '39',
        priceCurrency: 'EUR',
        name: 'Plainvoice Pro — bulk conversion',
        description: 'One-time payment; no subscription, no recurring fees.',
        availability: 'https://schema.org/OnlineOnly',
        url: `${BASE_URL}/de/buy`,
      },
    ],
    creator: {
      '@type': 'Organization',
      name: COMPANY.legalName,
      url: BASE_URL,
    },
  };
}

/** schema.org/Organization — YS Development B.V. */
export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: COMPANY.legalName,
    url: BASE_URL,
    address: {
      '@type': 'PostalAddress',
      streetAddress: COMPANY.streetAddress,
      postalCode: COMPANY.postalCode,
      addressLocality: COMPANY.city,
      addressCountry: 'NL',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      email: COMPANY.email,
    },
  };
}

/** schema.org/WebSite */
export function webSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Plainvoice',
    url: BASE_URL,
    inLanguage: ['de', 'en'],
    description: 'X-Rechnung converter — CSV, TXT, XLSX, PDF — fully in-browser',
  };
}
