const PT_PER_MM = 72 / 25.4;

export interface ImagePdfInput {
  jpeg: Uint8Array;
  imageWidth: number;
  imageHeight: number;
  pageWidthMm: number;
  pageHeightMm: number;
  copies?: number;
}

const encoder = new TextEncoder();

function bytes(s: string): Uint8Array {
  return encoder.encode(s);
}

function pdfNum(n: number): string {
  return n.toFixed(4).replace(/\.?0+$/, '');
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function streamObject(header: string, data: Uint8Array): (string | Uint8Array)[] {
  return [`${header} /Length ${data.length} >>\nstream\n`, data, '\nendstream'];
}

export function buildImagePdf(input: ImagePdfInput): Uint8Array {
  const copies = Math.max(1, Math.min(999, Math.floor(input.copies ?? 1)));
  const pageWidth = input.pageWidthMm * PT_PER_MM;
  const pageHeight = input.pageHeightMm * PT_PER_MM;
  const content = bytes(`q\n${pdfNum(pageWidth)} 0 0 ${pdfNum(pageHeight)} 0 0 cm\n/Im0 Do\nQ\n`);

  const objects: Array<Array<string | Uint8Array>> = [];
  const add = (parts: Array<string | Uint8Array>) => objects.push(parts);

  const pageIds = Array.from({ length: copies }, (_, i) => 5 + i * 2);
  add(['<< /Type /Catalog /Pages 2 0 R >>']);
  add([`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${copies} >>`]);
  add(
    streamObject(
      `<< /Type /XObject /Subtype /Image /Width ${input.imageWidth} /Height ${input.imageHeight}` +
        ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode',
      input.jpeg,
    ),
  );

  for (let i = 0; i < copies; i += 1) {
    const contentId = 4 + i * 2;
    add(streamObject('<<', content));
    add([
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pdfNum(pageWidth)} ${pdfNum(pageHeight)}] ` +
        `/Resources << /XObject << /Im0 3 0 R >> >> /Contents ${contentId} 0 R >>`,
    ]);
  }

  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let pos = 0;
  const push = (part: string | Uint8Array): void => {
    const b = typeof part === 'string' ? bytes(part) : part;
    chunks.push(b);
    pos += b.length;
  };

  push('%PDF-1.4\n');
  objects.forEach((parts, i) => {
    offsets[i + 1] = pos;
    push(`${i + 1} 0 obj\n`);
    parts.forEach(push);
    push('\nendobj\n');
  });

  const xref = pos;
  push(`xref\n0 ${objects.length + 1}\n`);
  push('0000000000 65535 f \n');
  for (let i = 1; i <= objects.length; i += 1) {
    push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  return concat(chunks);
}

export function makeImagePdfBlob(input: ImagePdfInput): Blob {
  const data = buildImagePdf(input);
  const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  return new Blob([buffer], { type: 'application/pdf' });
}

export function pdfFileName(name: string): string {
  const base = name.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').slice(0, 80) || 'label';
  return `${base}.pdf`;
}
