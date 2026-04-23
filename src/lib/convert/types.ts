import type { Invoice } from '@/lib/invoice';

export type Locale = 'de' | 'en';

export interface ConverterResult {
  blob: Blob;
  filename: string;
  mimeType: string;
  byteSize: number;
}

export interface BaseOptions {
  locale: Locale;
  fallbackFilename?: string;
}

export type CsvLayout = 'line-items' | 'header-only';
export type CsvSeparator = ';' | ',' | '\t';
export type CsvDecimal = ',' | '.';

export interface CsvOptions extends BaseOptions {
  layout: CsvLayout;
  separator: CsvSeparator;
  decimal: CsvDecimal;
}

export type TxtOptions = BaseOptions;
export type XlsxOptions = BaseOptions;

export type Converter<O extends BaseOptions> = (
  invoice: Invoice,
  options: O,
) => Promise<ConverterResult>;

export type OutputFormat = 'csv' | 'txt' | 'xlsx' | 'pdf';
