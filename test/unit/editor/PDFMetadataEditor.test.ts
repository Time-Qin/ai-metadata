import { describe, it, expect } from 'vitest';
import { PDFMetadataEditor } from '@/pdf/PDFMetadataEditor';
import { encodeUtf8, decodeUtf8 } from '@/utils/Encoding';
import { createEmptyMetadata } from '@/metadata/Metadata';
import { deflateSync } from 'node:zlib';

/**
 * 构建一个最小化的测试用 PDF（带 Info Dictionary）
 */
function buildMinimalPDF(): Uint8Array {
  const header = '%PDF-1.4\n';
  let pos = header.length;
  const offsets: number[] = [0];

  // Object 1: Catalog
  const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  offsets.push(pos);
  pos += obj1.length;

  // Object 2: Pages
  const obj2 = '2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n';
  offsets.push(pos);
  pos += obj2.length;

  // Object 3: Info Dictionary
  const obj3 = '3 0 obj\n<<\n  /Producer (Test PDF Generator)\n  /CreationDate (D:20260101000000)\n>>\nendobj\n';
  offsets.push(pos);
  pos += obj3.length;

  const xrefOffset = pos;
  const xrefLines = ['xref', `0 ${offsets.length}`];
  xrefLines.push('0000000000 65535 f ');
  for (let i = 1; i < offsets.length; i++) {
    xrefLines.push(`${String(offsets[i]!).padStart(10, '0')} 00000 n `);
  }
  const xref = xrefLines.join('\n') + '\n';

  const trailer = `trailer\n<< /Size ${offsets.length} /Root 1 0 R /Info 3 0 R >>\n`;
  const startxref = `startxref\n${xrefOffset}\n%%EOF\n`;

  return encodeUtf8(header + obj1 + obj2 + obj3 + xref + trailer + startxref);
}

/**
 * 构建没有 Info Dictionary 的 PDF
 */
function buildPDFWithoutInfo(): Uint8Array {
  const header = '%PDF-1.4\n';
  let pos = header.length;
  const offsets: number[] = [0];

  const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  offsets.push(pos);
  pos += obj1.length;

  const obj2 = '2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n';
  offsets.push(pos);
  pos += obj2.length;

  const xrefOffset = pos;
  const xrefLines = ['xref', `0 ${offsets.length}`];
  xrefLines.push('0000000000 65535 f ');
  for (let i = 1; i < offsets.length; i++) {
    xrefLines.push(`${String(offsets[i]!).padStart(10, '0')} 00000 n `);
  }
  const xref = xrefLines.join('\n') + '\n';

  const trailer = `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\n`;
  const startxref = `startxref\n${xrefOffset}\n%%EOF\n`;

  return encodeUtf8(header + obj1 + obj2 + xref + trailer + startxref);
}

/**
 * 构建使用 XRef Stream 的 PDF (PDF 1.5+)
 */
function buildXrefStreamPDF(opts: { compress?: boolean; withInfo?: boolean } = {}): Uint8Array {
  const { compress = false, withInfo = true } = opts;

  const header = '%PDF-1.7\n';
  let pos = header.length;
  const offsets: number[] = [0]; // obj 0 (free)

  const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  offsets.push(pos); pos += obj1.length;

  const obj2 = '2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n';
  offsets.push(pos); pos += obj2.length;

  let obj3 = '';
  let infoRef = '';
  let numObjects = 2;
  if (withInfo) {
    obj3 = '3 0 obj\n<< /Producer (Test PDF Generator) >>\nendobj\n';
    offsets.push(pos); pos += obj3.length;
    infoRef = ' /Info 3 0 R';
    numObjects = 3;
  }

  const xrefStreamOffset = pos;
  const w: [number, number, number] = [1, 2, 1];
  const entrySize = 4;
  const numEntries = numObjects + 2;
  const xrefData = new Uint8Array(entrySize * numEntries);
  let idx = 0;

  xrefData[idx++] = 0; xrefData[idx++] = 0; xrefData[idx++] = 0; xrefData[idx++] = 255;

  for (let i = 1; i <= numObjects; i++) {
    xrefData[idx++] = 1;
    xrefData[idx++] = (offsets[i]! >> 8) & 0xff;
    xrefData[idx++] = offsets[i]! & 0xff;
    xrefData[idx++] = 0;
  }

  const streamObjNum = numObjects + 1;
  xrefData[idx++] = 1;
  xrefData[idx++] = (xrefStreamOffset >> 8) & 0xff;
  xrefData[idx++] = xrefStreamOffset & 0xff;
  xrefData[idx++] = 0;

  let streamData = xrefData;
  let filterStr = '';
  if (compress) {
    streamData = new Uint8Array(deflateSync(xrefData));
    filterStr = ' /Filter /FlateDecode';
  }

  const streamDict = `<< /Type /XRef /Size ${numEntries} /Root 1 0 R${infoRef} /W [${w.join(' ')}] /Length ${streamData.length}${filterStr} >>`;
  const parts: Uint8Array[] = [
    encodeUtf8(header),
    encodeUtf8(obj1),
    encodeUtf8(obj2),
  ];
  if (withInfo) parts.push(encodeUtf8(obj3));
  parts.push(
    encodeUtf8(`${streamObjNum} 0 obj\n${streamDict}\nstream\n`),
    streamData,
    encodeUtf8('\nendstream\nendobj\n'),
    encodeUtf8(`startxref\n${xrefStreamOffset}\n%%EOF\n`),
  );

  const total = parts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { result.set(p, off); off += p.length; }
  return result;
}

const sampleMetadata = {
  label: 'AI',
  contentProducer: 'ChatGPT',
  produceId: 'ID-001',
  reservedCode1: '',
  contentPropagator: 'web',
  propagateId: 'ID-002',
  reservedCode2: '',
};

describe('PDFMetadataEditor', () => {
  it('写入和读取元数据', async () => {
    const pdfData = buildMinimalPDF();
    const editor = new PDFMetadataEditor(pdfData);

    await editor.write(sampleMetadata);

    const result = editor.getResult();
    const editor2 = new PDFMetadataEditor(result);
    const read = await editor2.read();

    expect(read).not.toBeNull();
    expect(read!.label).toBe('AI');
    expect(read!.contentProducer).toBe('ChatGPT');
    expect(read!.produceId).toBe('ID-001');
    expect(read!.contentPropagator).toBe('web');
    expect(read!.propagateId).toBe('ID-002');
  });

  it('检测元数据是否存在', async () => {
    const pdfData = buildMinimalPDF();
    const editor = new PDFMetadataEditor(pdfData);

    expect(await editor.has()).toBe(false);

    await editor.write(sampleMetadata);
    const editor2 = new PDFMetadataEditor(editor.getResult());
    expect(await editor2.has()).toBe(true);
  });

  it('删除元数据', async () => {
    const pdfData = buildMinimalPDF();
    const editor = new PDFMetadataEditor(pdfData);
    await editor.write(sampleMetadata);

    const editor2 = new PDFMetadataEditor(editor.getResult());
    expect(await editor2.has()).toBe(true);

    await editor2.remove();
    const editor3 = new PDFMetadataEditor(editor2.getResult());
    expect(await editor3.has()).toBe(false);
  });

  it('读取不存在的元数据返回 null', async () => {
    const pdfData = buildMinimalPDF();
    const editor = new PDFMetadataEditor(pdfData);

    const result = await editor.read();
    expect(result).toBeNull();
  });

  it('处理没有 Info Dictionary 的 PDF', async () => {
    const pdfData = buildPDFWithoutInfo();
    const editor = new PDFMetadataEditor(pdfData);

    expect(await editor.has()).toBe(false);
    expect(await editor.read()).toBeNull();

    // 写入会创建新的 Info Dictionary
    await editor.write(sampleMetadata);
    const editor2 = new PDFMetadataEditor(editor.getResult());
    expect(await editor2.has()).toBe(true);

    const read = await editor2.read();
    expect(read!.label).toBe('AI');
  });

  it('覆盖更新已有元数据', async () => {
    const pdfData = buildMinimalPDF();
    const editor = new PDFMetadataEditor(pdfData);
    await editor.write(sampleMetadata);

    const updatedMetadata = { ...sampleMetadata, label: 'Human', contentProducer: 'User' };
    const editor2 = new PDFMetadataEditor(editor.getResult());
    await editor2.write(updatedMetadata);

    const editor3 = new PDFMetadataEditor(editor2.getResult());
    const read = await editor3.read();

    expect(read!.label).toBe('Human');
    expect(read!.contentProducer).toBe('User');
  });

  it('保留原始 PDF Producer 字段', async () => {
    const pdfData = buildMinimalPDF();
    const editor = new PDFMetadataEditor(pdfData);
    await editor.write(sampleMetadata);

    // 重新解析，检查 Producer 是否保留
    const result = new PDFMetadataEditor(editor.getResult());
    await result.read(); // 触发解析

    // 检查 PDF 文本中是否包含原始 Producer
    const pdfText = decodeUtf8(new Uint8Array(editor.getResult()));
    expect(pdfText).toContain('Test PDF Generator');
  });

  it('处理空元数据', async () => {
    const pdfData = buildMinimalPDF();
    const editor = new PDFMetadataEditor(pdfData);
    await editor.write(createEmptyMetadata());

    const editor2 = new PDFMetadataEditor(editor.getResult());
    const read = await editor2.read();

    expect(read).not.toBeNull();
    expect(read!.label).toBe('');
    expect(read!.contentProducer).toBe('');
  });

  it('多次写入后仍然可读', async () => {
    const pdfData = buildMinimalPDF();

    // 第一次写入
    const editor1 = new PDFMetadataEditor(pdfData);
    await editor1.write(sampleMetadata);

    // 第二次写入
    const editor2 = new PDFMetadataEditor(editor1.getResult());
    const updated = { ...sampleMetadata, label: 'Second' };
    await editor2.write(updated);

    // 读取
    const editor3 = new PDFMetadataEditor(editor2.getResult());
    const read = await editor3.read();

    expect(read!.label).toBe('Second');
  });

  // === XRef Stream (PDF 1.5+) 测试 ===

  it('XRef Stream PDF: 写入和读取元数据', async () => {
    const pdfData = buildXrefStreamPDF();
    const editor = new PDFMetadataEditor(pdfData);

    await editor.write(sampleMetadata);

    const editor2 = new PDFMetadataEditor(editor.getResult());
    const read = await editor2.read();

    expect(read).not.toBeNull();
    expect(read!.label).toBe('AI');
    expect(read!.contentProducer).toBe('ChatGPT');
    expect(read!.produceId).toBe('ID-001');
  });

  it('XRef Stream PDF: 检测元数据是否存在', async () => {
    const pdfData = buildXrefStreamPDF();
    const editor = new PDFMetadataEditor(pdfData);

    expect(await editor.has()).toBe(false);

    await editor.write(sampleMetadata);
    const editor2 = new PDFMetadataEditor(editor.getResult());
    expect(await editor2.has()).toBe(true);
  });

  it('XRef Stream PDF: 删除元数据', async () => {
    const pdfData = buildXrefStreamPDF();
    const editor = new PDFMetadataEditor(pdfData);
    await editor.write(sampleMetadata);

    const editor2 = new PDFMetadataEditor(editor.getResult());
    expect(await editor2.has()).toBe(true);

    await editor2.remove();
    const editor3 = new PDFMetadataEditor(editor2.getResult());
    expect(await editor3.has()).toBe(false);
  });

  it('XRef Stream PDF (压缩): 写入和读取', async () => {
    const pdfData = buildXrefStreamPDF({ compress: true });
    const editor = new PDFMetadataEditor(pdfData);

    await editor.write(sampleMetadata);

    const editor2 = new PDFMetadataEditor(editor.getResult());
    const read = await editor2.read();

    expect(read).not.toBeNull();
    expect(read!.label).toBe('AI');
  });

  it('XRef Stream PDF 无 Info: 写入创建新 Info', async () => {
    const pdfData = buildXrefStreamPDF({ withInfo: false });
    const editor = new PDFMetadataEditor(pdfData);

    expect(await editor.has()).toBe(false);
    expect(await editor.read()).toBeNull();

    await editor.write(sampleMetadata);
    const editor2 = new PDFMetadataEditor(editor.getResult());
    expect(await editor2.has()).toBe(true);

    const read = await editor2.read();
    expect(read!.label).toBe('AI');
  });

  it('XRef Stream PDF: 保留原始 Producer', async () => {
    const pdfData = buildXrefStreamPDF();
    const editor = new PDFMetadataEditor(pdfData);
    await editor.write(sampleMetadata);

    const pdfText = decodeUtf8(new Uint8Array(editor.getResult()));
    expect(pdfText).toContain('Test PDF Generator');
  });

  it('XRef Stream PDF: 多次增量更新后可读', async () => {
    const pdfData = buildXrefStreamPDF();

    const editor1 = new PDFMetadataEditor(pdfData);
    await editor1.write(sampleMetadata);

    const editor2 = new PDFMetadataEditor(editor1.getResult());
    await editor2.write({ ...sampleMetadata, label: 'Updated' });

    const editor3 = new PDFMetadataEditor(editor2.getResult());
    const read = await editor3.read();
    expect(read!.label).toBe('Updated');
  });
});
