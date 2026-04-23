'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export interface ResultPanelProps {
  filename: string;
  byteSize: number;
  onReset: () => void;
}

export function ResultPanel({ filename, byteSize, onReset }: ResultPanelProps) {
  const t = useTranslations('Converter');
  const kb = Math.max(1, Math.round(byteSize / 1024));
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{t('readyTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <p>{t('readyBody')}</p>
        <p className="text-[color:var(--muted-foreground)]">
          <span className="font-medium break-all">{filename}</span>
          <span className="mx-2">·</span>
          <span>{t('fileSize', { size: kb })}</span>
        </p>
        <div>
          <Button variant="outline" size="sm" onClick={onReset}>
            {t('convertAnother')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
