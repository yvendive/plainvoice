// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { collectFromInput, BulkLimitError } from '@/lib/bulk/collect';

function makeFile(name: string, sizeBytes = 100, content = 'x'): File {
  const blob = new Blob([content.repeat(sizeBytes).slice(0, sizeBytes)]);
  return new File([blob], name);
}

describe('collectFromInput', () => {
  it('accepts multiple XML files', async () => {
    const files = [makeFile('a.xml'), makeFile('b.xml'), makeFile('c.xml')];
    const result = await collectFromInput(files);
    expect(result.files).toHaveLength(3);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects non-XML files with errors', async () => {
    const files = [makeFile('invoice.xml'), makeFile('readme.txt'), makeFile('data.csv')];
    const result = await collectFromInput(files);
    expect(result.files).toHaveLength(1);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0].filename).toBe('readme.txt');
    expect(result.errors[1].filename).toBe('data.csv');
  });

  it('throws BulkLimitError(too-many) when exceeding 50 files', async () => {
    const files = Array.from({ length: 51 }, (_, i) => makeFile(`f${i}.xml`));
    await expect(collectFromInput(files)).rejects.toThrow(BulkLimitError);
    await expect(collectFromInput(files)).rejects.toMatchObject({ kind: 'too-many' });
  });

  it('throws BulkLimitError(too-large) when total size exceeds 100 MB', async () => {
    // Each file is just over 2 MB; 51 would exceed 100 MB but we need to stay under 50 files.
    // Use 50 files each slightly over 2 MB to exceed 100 MB total.
    const bigContent = 'A'.repeat(2 * 1024 * 1024 + 1);
    const files = Array.from({ length: 50 }, (_, i) => {
      const blob = new Blob([bigContent]);
      return new File([blob], `f${i}.xml`);
    });
    await expect(collectFromInput(files)).rejects.toThrow(BulkLimitError);
    await expect(collectFromInput(files)).rejects.toMatchObject({ kind: 'too-large' });
  });

  it('ignores cruft files silently', async () => {
    const files = [makeFile('.DS_Store'), makeFile('invoice.xml'), makeFile('._hidden.xml')];
    const result = await collectFromInput(files);
    expect(result.files).toHaveLength(1);
    expect(result.files[0].name).toBe('invoice.xml');
    expect(result.errors).toHaveLength(0);
  });

  it('BulkLimitError has correct name', () => {
    const err = new BulkLimitError('too-many');
    expect(err.name).toBe('BulkLimitError');
    expect(err instanceof Error).toBe(true);
  });

  it('handles a File[] (post-snapshot of FileList) identically to a FileList', async () => {
    const arr: File[] = [makeFile('a.xml'), makeFile('b.xml')];
    const result = await collectFromInput(arr);
    expect(result.files).toHaveLength(2);
  });

  it('rejects per-file >5 MB with reason "file too large" — does NOT throw', async () => {
    // 5 MB + 1 byte triggers the per-file cap (#17). Distinct from the
    // 100 MB total cap which throws BulkLimitError.
    const big = makeFile('huge.xml', 5 * 1024 * 1024 + 1);
    const small = makeFile('tiny.xml', 100);
    const result = await collectFromInput([big, small]);
    expect(result.files).toHaveLength(1);
    expect(result.files[0].name).toBe('tiny.xml');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({ filename: 'huge.xml', reason: 'file too large' });
  });

  it('accepts a 4.9 MB XML file (boundary)', async () => {
    const justUnder = makeFile('big-but-ok.xml', 5 * 1024 * 1024 - 1);
    const result = await collectFromInput([justUnder]);
    expect(result.files).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it('does NOT read the body of an oversize file (no text() call)', async () => {
    // Build a 5.1 MB File then spy on its .text() method. The size cap
    // must be enforced before any expensive read.
    const big = makeFile('huge.xml', 5 * 1024 * 1024 + 1);
    const textSpy = vi.spyOn(big, 'text');
    const arrayBufferSpy = vi.spyOn(big, 'arrayBuffer');

    const result = await collectFromInput([big]);

    expect(result.files).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].reason).toBe('file too large');
    expect(textSpy).not.toHaveBeenCalled();
    expect(arrayBufferSpy).not.toHaveBeenCalled();
  });
});
