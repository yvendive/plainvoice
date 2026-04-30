import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

const CLOUDFLARE_ANALYTICS_TOKEN = process.env.NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN;

export const metadata: Metadata = {
  title: 'Plainvoice',
  description: 'Convert X-Rechnung XML to CSV, TXT, XLSX, or PDF in your browser.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body className="min-h-screen antialiased">{children}</body>
      {CLOUDFLARE_ANALYTICS_TOKEN ? (
        <Script
          defer
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon={JSON.stringify({ token: CLOUDFLARE_ANALYTICS_TOKEN })}
          strategy="afterInteractive"
        />
      ) : null}
    </html>
  );
}
