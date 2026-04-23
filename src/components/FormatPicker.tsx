'use client';

import { useTranslations } from 'next-intl';
import type { OutputFormat } from '@/lib/convert';
import { cn } from '@/lib/utils';

export interface FormatPickerProps {
  value: OutputFormat;
  onChange: (format: OutputFormat) => void;
  disabledFormats?: OutputFormat[];
}

type Option = { value: OutputFormat; labelKey: Parameters<ReturnType<typeof useTranslations>>[0] };

const OPTIONS: ReadonlyArray<Option> = [
  { value: 'pdf', labelKey: 'formatPdf' },
  { value: 'xlsx', labelKey: 'formatXlsx' },
  { value: 'csv', labelKey: 'formatCsv' },
  { value: 'txt', labelKey: 'formatTxt' },
] as const;

export function FormatPicker({
  value,
  onChange,
  disabledFormats = ['pdf'],
}: FormatPickerProps) {
  const t = useTranslations('Converter');
  return (
    <fieldset className="w-full">
      <legend className="mb-2 text-sm font-medium">{t('selectFormat')}</legend>
      <div
        role="radiogroup"
        aria-label={t('selectFormat')}
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {OPTIONS.map((opt) => {
          const disabled = disabledFormats.includes(opt.value);
          const checked = value === opt.value;
          return (
            <label
              key={opt.value}
              className={cn(
                'relative flex cursor-pointer flex-col items-start gap-1 rounded-lg border px-3 py-3 text-sm transition-colors',
                disabled
                  ? 'cursor-not-allowed opacity-70'
                  : checked
                    ? 'border-[color:var(--accent)] bg-[color:var(--muted)]'
                    : 'border-[color:var(--border)] hover:border-[color:var(--accent)]/60',
              )}
            >
              <input
                type="radio"
                name="output-format"
                value={opt.value}
                checked={checked}
                disabled={disabled}
                onChange={() => !disabled && onChange(opt.value)}
                className="sr-only"
              />
              <span className="font-medium">{t(opt.labelKey)}</span>
              {disabled ? (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900">
                  {t('comingSoonBadge')}
                </span>
              ) : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
