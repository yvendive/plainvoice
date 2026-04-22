import type { Invoice } from './schema';

export type SourceSyntax = 'UBL' | 'CII';

export type ParseError =
  | { kind: 'not-xml'; detail: string }
  | { kind: 'not-xrechnung'; detail: string }
  | { kind: 'missing-required-field'; field: string; xpath: string }
  | { kind: 'invalid-field'; field: string; xpath: string; detail: string }
  | { kind: 'unknown-syntax'; rootElement: string };

export type ParseWarning =
  | { kind: 'missing-optional-field'; field: string }
  | { kind: 'unrecognised-version'; detail: string }
  | { kind: 'deprecated-version'; detail: string }
  | { kind: 'unsupported-date-format'; format: string; raw: string };

export type ParseResult =
  | { ok: true; invoice: Invoice; warnings: ParseWarning[] }
  | { ok: false; error: ParseError };
