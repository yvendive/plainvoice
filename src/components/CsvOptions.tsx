'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { CsvCompatibility, CsvDecimal, CsvLayout, CsvSeparator } from '@/lib/convert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

export interface CsvOptionsValue {
  compatibility: CsvCompatibility;
  layout: CsvLayout;
  separator: CsvSeparator;
  decimal: CsvDecimal;
}

export interface CsvOptionsProps {
  value: CsvOptionsValue;
  onChange: (next: CsvOptionsValue) => void;
}

export function CsvOptions({ value, onChange }: CsvOptionsProps) {
  const t = useTranslations('Converter');
  const [open, setOpen] = useState(false);

  return (
    <details
      className="w-full rounded-lg border bg-[color:var(--muted)]/40"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
        {t('csvOptions')} {open ? '▾' : '▸'}
      </summary>
      <div className="flex flex-col gap-4 px-4 pb-4 text-sm">
        <div>
          <p className="mb-2 font-medium">{t('csvCompatibility')}</p>
          <RadioGroup
            name="csv-compatibility"
            value={value.compatibility}
            onValueChange={(next) => onChange({ ...value, compatibility: next as CsvCompatibility })}
          >
            <RadioGroupItem
              value="modern"
              label={t('csvCompatibilityModern')}
              hint={t('csvCompatibilityModernHint')}
            />
            <RadioGroupItem
              value="legacy"
              label={t('csvCompatibilityLegacy')}
              hint={t('csvCompatibilityLegacyHint')}
            />
          </RadioGroup>
        </div>

        <div>
          <p className="mb-2 font-medium">{t('csvLayout')}</p>
          <RadioGroup
            name="csv-layout"
            value={value.layout}
            onValueChange={(next) => onChange({ ...value, layout: next as CsvLayout })}
          >
            <RadioGroupItem value="line-items" label={t('csvLayoutLines')} />
            <RadioGroupItem value="header-only" label={t('csvLayoutHeader')} />
          </RadioGroup>
        </div>

        <div>
          <p className="mb-2 font-medium">{t('csvSeparator')}</p>
          <RadioGroup
            name="csv-separator"
            value={value.separator}
            onValueChange={(next) => {
              const nextSeparator = next as CsvSeparator;
              // Gotcha §9.2: comma separator collides with comma decimal — flip the decimal to dot.
              const nextDecimal =
                nextSeparator === ',' && value.decimal === ',' ? '.' : value.decimal;
              onChange({ ...value, separator: nextSeparator, decimal: nextDecimal });
            }}
          >
            <RadioGroupItem value=";" label={t('csvSeparatorSemicolon')} />
            <RadioGroupItem value="," label={t('csvSeparatorComma')} />
            <RadioGroupItem value={'\t'} label={t('csvSeparatorTab')} />
          </RadioGroup>
        </div>

        <div>
          <p className="mb-2 font-medium">{t('csvDecimal')}</p>
          <RadioGroup
            name="csv-decimal"
            value={value.decimal}
            onValueChange={(next) => onChange({ ...value, decimal: next as CsvDecimal })}
          >
            <RadioGroupItem value="," label={t('csvDecimalComma')} />
            <RadioGroupItem value="." label={t('csvDecimalDot')} />
          </RadioGroup>
        </div>
      </div>
    </details>
  );
}
