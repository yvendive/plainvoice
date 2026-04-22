import type { Metadata } from 'next';
import './globals.css';

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
    </html>
  );
}
