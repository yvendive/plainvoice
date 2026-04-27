// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { unzipXmlFiles } from '@/lib/bulk/collect';

function makeZip(entries: Record<string, string>): File {
  const data: Record<string, Uint8Array> = {};
  for (const [path, content] of Object.entries(entries)) {
    data[path] = strToU8(content);
  }
  const zipped = zipSync(data);
  return new File([zipped as unknown as Uint8Array<ArrayBuffer>], 'test.zip', { type: 'application/zip' });
}

describe('unzipXmlFiles', () => {
  it('extracts XML files from ZIP', async () => {
    const zip = makeZip({
      'invoice-1.xml': '<Invoice/>',
      'invoice-2.xml': '<Invoice/>',
    });
    const result = await unzipXmlFiles(zip);
    expect(result.files).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
    const names = result.files.map((f) => f.name).sort();
    expect(names).toEqual(['invoice-1.xml', 'invoice-2.xml']);
  });

  it('filters out .DS_Store cruft silently', async () => {
    const zip = makeZip({
      'invoice-1.xml': '<Invoice/>',
      'invoice-2.xml': '<Invoice/>',
      '.DS_Store': 'binary cruft',
    });
    const result = await unzipXmlFiles(zip);
    expect(result.files).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });

  it('filters out __MACOSX/ entries silently', async () => {
    const zip = makeZip({
      'invoice.xml': '<Invoice/>',
      '__MACOSX/._invoice.xml': 'binary cruft',
    });
    const result = await unzipXmlFiles(zip);
    expect(result.files).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it('filters out ._* dot-underscore files silently', async () => {
    const zip = makeZip({
      'invoice.xml': '<Invoice/>',
      '._invoice.xml': 'binary cruft',
    });
    const result = await unzipXmlFiles(zip);
    expect(result.files).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it('reports non-XML non-cruft files in errors', async () => {
    const zip = makeZip({
      'invoice.xml': '<Invoice/>',
      'readme.txt': 'some text',
    });
    const result = await unzipXmlFiles(zip);
    expect(result.files).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].filename).toBe('readme.txt');
  });

  it('uses only the basename for the resulting File name', async () => {
    const zip = makeZip({
      'subdir/invoice.xml': '<Invoice/>',
    });
    const result = await unzipXmlFiles(zip);
    expect(result.files[0].name).toBe('invoice.xml');
  });

  it('sets MIME type text/xml on extracted files', async () => {
    const zip = makeZip({ 'inv.xml': '<Invoice/>' });
    const result = await unzipXmlFiles(zip);
    expect(result.files[0].type).toBe('text/xml');
  });
});
