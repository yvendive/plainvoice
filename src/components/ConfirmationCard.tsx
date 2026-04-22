'use client';

import { useTranslations } from 'next-intl';
import type { Invoice } from '@/lib/invoice';
import { formatMoney } from '@/lib/convert/format';
import type { Locale } from '@/lib/convert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface ConfirmationCardProps {
  filename: string;
  invoice: Invoice;
  locale: Locale;
}

export function ConfirmationCard({ filename, invoice, locale }: ConfirmationCardProps) {
  const t = useTranslations('Converter');
  const total = formatMoney(invoice.totals.taxInclusive, invoice.currency, locale);

  const rows: Array<[string, string]> = [
    [t('confirmFilename'), filename],
    [t('confirmSyntax'), invoice.sourceSyntax],
    [t('confirmNumber'), invoice.number],
    [t('confirmIssueDate'), invoice.issueDate],
    [t('confirmSeller'), invoice.seller.name],
    [t('confirmBuyer'), invoice.buyer.name],
    [t('confirmTotal'), total],
  ];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{t('confirmTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-[color:var(--muted-foreground)]">{label}</dt>
              <dd className="break-words font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
