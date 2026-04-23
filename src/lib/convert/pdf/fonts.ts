import type { PDFDocument, PDFFont } from 'pdf-lib';

const REGULAR_REL = 'fonts/Inter-Regular.ttf';
const BOLD_REL = 'fonts/Inter-Bold.ttf';

async function loadBytes(relPath: string): Promise<ArrayBuffer> {
  if (typeof window === 'undefined') {
    const fs = await import('node:fs/promises');
    const nodePath = await import('node:path');
    const buf = await fs.readFile(nodePath.join(process.cwd(), 'public', relPath));
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }
  const response = await fetch('/' + relPath);
  if (!response.ok) throw new Error(`failed to fetch ${relPath}: ${response.status}`);
  return response.arrayBuffer();
}

export async function embedInter(
  doc: PDFDocument,
): Promise<{ regular: PDFFont; bold: PDFFont }> {
  const fontkitModule = await import('@pdf-lib/fontkit');
  const fontkit = fontkitModule.default ?? fontkitModule;
  doc.registerFontkit(fontkit as Parameters<typeof doc.registerFontkit>[0]);

  const [regularBytes, boldBytes] = await Promise.all([
    loadBytes(REGULAR_REL),
    loadBytes(BOLD_REL),
  ]);

  const [regular, bold] = await Promise.all([
    doc.embedFont(regularBytes, { subset: true }),
    doc.embedFont(boldBytes, { subset: true }),
  ]);

  return { regular, bold };
}
