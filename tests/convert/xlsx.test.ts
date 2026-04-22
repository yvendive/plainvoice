// @vitest-environment node
import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { convertXlsx, labelsFor } from '@/lib/convert';
import { FIXTURES, loadFixture } from './_fixtures';

async function readWorkbook(blob: Blob): Promise<ExcelJS.Workbook> {
  const buffer = await blob.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return wb;
}

describe('convertXlsx', () => {
  it('produces a workbook with three correctly-named sheets (DE)', async () => {
    const invoice = loadFixture('ubl-invoice-standard.xml');
    const { blob } = await convertXlsx(invoice, { locale: 'de' });
    const wb = await readWorkbook(blob);
    const names = wb.worksheets.map((w) => w.name);
    const L = labelsFor('de');
    expect(names).toEqual([L.sheets.overview, L.sheets.lines, L.sheets.tax]);
  });

  it('produces a workbook with three correctly-named sheets (EN)', async () => {
    const invoice = loadFixture('ubl-invoice-standard.xml');
    const { blob } = await convertXlsx(invoice, { locale: 'en' });
    const wb = await readWorkbook(blob);
    const names = wb.worksheets.map((w) => w.name);
    const L = labelsFor('en');
    expect(names).toEqual([L.sheets.overview, L.sheets.lines, L.sheets.tax]);
  });

  it('line-items sheet has one data row per invoice line', async () => {
    const invoice = loadFixture('cii-mixed-rate.xml');
    const { blob } = await convertXlsx(invoice, { locale: 'de' });
    const wb = await readWorkbook(blob);
    const lines = wb.getWorksheet(labelsFor('de').sheets.lines);
    expect(lines).toBeDefined();
    // rowCount = header (1) + data (N)
    expect(lines!.rowCount).toBe(1 + invoice.lines.length);
  });

  it('tax-breakdown sheet has one data row per tax row', async () => {
    const invoice = loadFixture('cii-mixed-rate.xml');
    const { blob } = await convertXlsx(invoice, { locale: 'de' });
    const wb = await readWorkbook(blob);
    const tax = wb.getWorksheet(labelsFor('de').sheets.tax);
    expect(tax).toBeDefined();
    expect(tax!.rowCount).toBe(1 + invoice.taxBreakdown.length);
  });

  it('freezes the header row on line-items and tax sheets', async () => {
    const invoice = loadFixture('ubl-invoice-standard.xml');
    const { blob } = await convertXlsx(invoice, { locale: 'de' });
    const wb = await readWorkbook(blob);
    const lines = wb.getWorksheet(labelsFor('de').sheets.lines)!;
    const tax = wb.getWorksheet(labelsFor('de').sheets.tax)!;
    expect(lines.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    expect(tax.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
  });

  it('currency cells carry a format containing the currency symbol', async () => {
    const invoice = loadFixture('ubl-invoice-standard.xml');
    const { blob } = await convertXlsx(invoice, { locale: 'de' });
    const wb = await readWorkbook(blob);
    const lines = wb.getWorksheet(labelsFor('de').sheets.lines)!;
    const netCol = lines.getColumn(7); // 7th col = lineNetAmount
    expect(netCol.numFmt ?? '').toContain('€');
  });

  it('column widths are clamped to [12, 60] in Excel points (10..50 × 1.2)', async () => {
    const invoice = loadFixture('ubl-invoice-standard.xml');
    const { blob } = await convertXlsx(invoice, { locale: 'de' });
    const wb = await readWorkbook(blob);
    const lines = wb.getWorksheet(labelsFor('de').sheets.lines)!;
    lines.columns.forEach((col) => {
      expect(col.width).toBeGreaterThanOrEqual(12);
      expect(col.width).toBeLessThanOrEqual(60);
    });
  });

  it.each(FIXTURES)('round-trips %s through ExcelJS', async (name) => {
    const invoice = loadFixture(name);
    const { blob } = await convertXlsx(invoice, { locale: 'en' });
    const wb = await readWorkbook(blob);
    expect(wb.worksheets.length).toBe(3);
  });
});
