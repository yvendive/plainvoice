import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://plainvoice.de';
  const now = new Date();
  return [
    { url: `${base}/de`, lastModified: now, changeFrequency: 'monthly', priority: 1 },
    { url: `${base}/en`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/de/datenschutz`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/en/datenschutz`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/de/impressum`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/en/impressum`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/de/agb`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/en/agb`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
