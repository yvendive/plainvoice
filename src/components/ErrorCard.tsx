'use client';

import { useTranslations } from 'next-intl';
import type { ParseError } from '@/lib/invoice';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export interface ErrorCardProps {
  error: ParseError | { kind: 'too-big' } | { kind: 'generic'; detail?: string };
  onReset: () => void;
}

export function ErrorCard({ error, onReset }: ErrorCardProps) {
  const t = useTranslations('Converter');

  let body: string;
  switch (error.kind) {
    case 'not-xml':
      body = t('errorNotXml');
      break;
    case 'not-xrechnung':
      body = t('errorNotXrechnung');
      break;
    case 'missing-required-field':
      body = t('errorMissing', { field: error.field });
      break;
    case 'invalid-field':
      body = t('errorInvalid', { field: error.field });
      break;
    case 'unknown-syntax':
      body = t('errorUnknownSyntax', { root: error.rootElement });
      break;
    case 'too-big':
      body = t('errorTooBig');
      break;
    default:
      body = t('errorGeneric');
  }

  return (
    <Alert variant="destructive" className="w-full">
      <AlertTitle>{t('errorTitle')}</AlertTitle>
      <AlertDescription className="mt-1">{body}</AlertDescription>
      <div className="mt-3">
        <Button variant="outline" size="sm" onClick={onReset}>
          {t('errorRetry')}
        </Button>
      </div>
    </Alert>
  );
}
