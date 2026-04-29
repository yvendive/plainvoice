import { unzip } from 'fflate';
import { MAX_XML_FILE_BYTES } from '@/lib/invoice/limits';

export interface BulkInputError {
  filename: string;
  reason: string;
}

export interface BulkInputResult {
  files: File[];
  errors: BulkInputError[];
}

export class BulkLimitError extends Error {
  constructor(public readonly kind: 'too-many' | 'too-large') {
    super(kind);
    this.name = 'BulkLimitError';
  }
}

const MAX_FILES = 50;
const MAX_BYTES_TOTAL = 100 * 1024 * 1024;

/**
 * Per-file-too-large reason marker used in BulkInputError.reason. Stable
 * string literal so the UI can map to the i18n Errors.fileTooLarge key.
 * See #17.
 */
export const REASON_FILE_TOO_LARGE = 'file too large';

function isXml(name: string): boolean {
  return name.toLowerCase().endsWith('.xml');
}

function isZip(name: string): boolean {
  return name.toLowerCase().endsWith('.zip');
}

function isCruft(name: string): boolean {
  const basename = name.split('/').pop() ?? name;
  return (
    basename.startsWith('.') ||
    basename.startsWith('._') ||
    name.startsWith('__MACOSX/')
  );
}

function checkLimits(files: File[]): void {
  if (files.length > MAX_FILES) throw new BulkLimitError('too-many');
  const total = files.reduce((s, f) => s + f.size, 0);
  if (total > MAX_BYTES_TOTAL) throw new BulkLimitError('too-large');
}

function partitionXml(files: File[]): { xml: File[]; errors: BulkInputError[] } {
  const xml: File[] = [];
  const errors: BulkInputError[] = [];
  for (const f of files) {
    if (isCruft(f.name)) continue;
    if (!isXml(f.name)) {
      errors.push({ filename: f.name, reason: 'not XML' });
      continue;
    }
    // Per-file size cap (#17). Enforced BEFORE the file lands in the
    // "to convert" set so a single oversize XML can't push the bulk run
    // into a freeze; total-bulk cap (100 MB) still applies on top.
    if (f.size > MAX_XML_FILE_BYTES) {
      errors.push({ filename: f.name, reason: REASON_FILE_TOO_LARGE });
      continue;
    }
    xml.push(f);
  }
  return { xml, errors };
}

// ── FileList / multi-select ────────────────────────────────────────────────

export async function collectFromInput(
  list: FileList | ArrayLike<File>,
): Promise<BulkInputResult> {
  const files = Array.from(list as ArrayLike<File>);

  // Single ZIP → unpack first
  if (files.length === 1 && isZip(files[0].name)) {
    return unzipXmlFiles(files[0]);
  }

  const { xml, errors } = partitionXml(files);
  checkLimits(xml);
  return { files: xml, errors };
}

// ── Drag-drop ─────────────────────────────────────────────────────────────

async function readDirectoryEntry(entry: FileSystemDirectoryEntry): Promise<File[]> {
  return new Promise((resolve) => {
    const reader = entry.createReader();
    const all: FileSystemEntry[] = [];

    function readNext() {
      reader.readEntries(async (batch) => {
        if (batch.length === 0) {
          const nested = await Promise.all(
            all.map((e) =>
              e.isDirectory
                ? readDirectoryEntry(e as FileSystemDirectoryEntry)
                : new Promise<File[]>((res, rej) =>
                    (e as FileSystemFileEntry).file((f) => res([f]), rej),
                  ),
            ),
          );
          resolve(nested.flat());
        } else {
          all.push(...batch);
          readNext();
        }
      });
    }
    readNext();
  });
}

export async function collectFromDrop(dt: DataTransfer): Promise<BulkInputResult> {
  const rawFiles: File[] = [];

  if (dt.items && dt.items.length > 0) {
    const entryPromises: Promise<File[]>[] = [];
    for (const item of Array.from(dt.items)) {
      const entry = item.webkitGetAsEntry?.();
      if (!entry) {
        if (item.kind === 'file') {
          const f = item.getAsFile();
          if (f) rawFiles.push(f);
        }
        continue;
      }
      if (entry.isDirectory) {
        entryPromises.push(readDirectoryEntry(entry as FileSystemDirectoryEntry));
      } else {
        entryPromises.push(
          new Promise((res, rej) =>
            (entry as FileSystemFileEntry).file((f) => res([f]), rej),
          ),
        );
      }
    }
    const nested = await Promise.all(entryPromises);
    rawFiles.push(...nested.flat());
  } else {
    rawFiles.push(...Array.from(dt.files));
  }

  // Single ZIP → unpack
  if (rawFiles.length === 1 && isZip(rawFiles[0].name)) {
    return unzipXmlFiles(rawFiles[0]);
  }

  const { xml, errors } = partitionXml(rawFiles);
  checkLimits(xml);
  return { files: xml, errors };
}

// ── ZIP unpacking ──────────────────────────────────────────────────────────

export async function unzipXmlFiles(zipFile: File): Promise<BulkInputResult> {
  const buffer = new Uint8Array(await zipFile.arrayBuffer());
  const unpacked = await new Promise<Record<string, Uint8Array>>((res, rej) =>
    unzip(buffer, (err, data) => (err ? rej(err) : res(data))),
  );

  const xmlFiles: File[] = [];
  const errors: BulkInputError[] = [];

  for (const [path, bytes] of Object.entries(unpacked)) {
    if (isCruft(path)) continue;
    if (!isXml(path)) {
      errors.push({ filename: path, reason: 'not XML' });
      continue;
    }
    // Per-file size cap (#17). Applied to ZIP entries too so an attacker
    // can't ship a 50 MB XML hidden inside a small archive.
    if (bytes.length > MAX_XML_FILE_BYTES) {
      errors.push({ filename: path, reason: REASON_FILE_TOO_LARGE });
      continue;
    }
    const basename = path.split('/').pop() ?? path;
    xmlFiles.push(new File([bytes as unknown as Uint8Array<ArrayBuffer>], basename, { type: 'text/xml' }));
  }

  checkLimits(xmlFiles);
  return { files: xmlFiles, errors };
}
