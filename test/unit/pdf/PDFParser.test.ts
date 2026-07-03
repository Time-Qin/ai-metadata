import { describe, it, expect } from 'vitest';
import { PDFParser } from '@/pdf/PDFParser';
import { IncrementWriter } from '@/pdf/IncrementWriter';
import { InfoDictionary } from '@/pdf/InfoDictionary';
import { encodeUtf8, decodeUtf8 } from '@/utils/Encoding';
import { deflateSync } from 'node:zlib';

/**
 * 构建一个最小化的测试用 PDF (传统 xref 表)
 */
function buildMinimalPDF(): Uint8Array {
  const objects: string[] = [];
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  objects.push('2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n');
  objects.push('3 0 obj\n<<\n  /Producer (Test PDF Generator)\n  /CreationDate (D:20260101000000)\n>>\nendobj\n');

  const header = '%PDF-1.4\n';
  let pos = header.length;
  const offsets: number[] = [0];

  let body = '';
  for (const obj of objects) {
    offsets.push(pos);
    body += obj;
    pos += obj.length;
  }

  const xrefOffset = pos;
  const xrefLines = ['xref', `0 ${offsets.length}`];
  xrefLines.push('0000000000 65535 f ');
  for (let i = 1; i < offsets.length; i++) {
    xrefLines.push(`${String(offsets[i]!).padStart(10, '0')} 00000 n `);
  }
  const xref = xrefLines.join('\n') + '\n';

  const trailer = `trailer\n<< /Size ${offsets.length} /Root 1 0 R /Info 3 0 R >>\n`;
  const startxref = `startxref\n${xrefOffset}\n%%EOF\n`;

  return encodeUtf8(header + body + xref + trailer + startxref);
}

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
 * 构建使用 XRef Stream 的最小化 PDF (PDF 1.5+)
 */
function buildXrefStreamPDF(options: { compress?: boolean } = {}): Uint8Array {
  const { compress = false } = options;

  const header = '%PDF-1.7\n';
  let pos = header.length;
  const offsets: number[] = [0]; // obj 0 (free)

  // Object 1: Catalog
  const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  offsets.push(pos);
  pos += obj1.length;

  // Object 2: Pages
  const obj2 = '2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n';
  offsets.push(pos);
  pos += obj2.length;

  // Object 3: Info Dictionary
  const obj3 = '3 0 obj\n<< /Producer (Test PDF Generator) >>\nendobj\n';
  offsets.push(pos);
  pos += obj3.length;

  // 构建 XRef Stream (object 4)
  // /W [1 2 1] — 每条目 4 字节
  const w: [number, number, number] = [1, 2, 1];
  const entrySize = w[0] + w[1] + w[2]; // 4
  const numEntries = 5; // obj 0-4

  const xrefBytes = new Uint8Array(entrySize * numEntries);
  let idx = 0;

  // Entry 0: free
  xrefBytes[idx++] = 0; // type 0
  xrefBytes[idx++] = 0; xrefBytes[idx++] = 0; // next free = 0
  xrefBytes[idx++] = 255; // gen = 255

  // Entries 1-3: objects
  for (let i = 1; i <= 3; i++) {
    xrefBytes[idx++] = 1; // type 1
    xrefBytes[idx++] = (offsets[i]! >> 8) & 0xff;
    xrefBytes[idx++] = offsets[i]! & 0xff;
    xrefBytes[idx++] = 0; // gen 0
  }

  // Entry 4: the XRef stream object itself (offset will be filled later)
  const xrefStreamObjOffset = pos;
  xrefBytes[idx++] = 1; // type 1
  xrefBytes[idx++] = (xrefStreamObjOffset >> 8) & 0xff;
  xrefBytes[idx++] = xrefStreamObjOffset & 0xff;
  xrefBytes[idx++] = 0; // gen 0

  // 压缩（可选）
  let streamData = xrefBytes;
  let filterStr = '';
  if (compress) {
    streamData = new Uint8Array(deflateSync(xrefBytes));
    filterStr = ' /Filter /FlateDecode';
  }

  const streamDict = `<< /Type /XRef /Size ${numEntries} /Root 1 0 R /Info 3 0 R /W [${w.join(' ')}] /Length ${streamData.length}${filterStr} >>`;

  // 构建 stream 对象
  const streamObjParts: Uint8Array[] = [
    encodeUtf8(`4 0 obj\n${streamDict}\nstream\n`),
    streamData,
    encodeUtf8('\nendstream\nendobj\n'),
  ];

  const streamObjLen = streamObjParts.reduce((s, p) => s + p.length, 0);

  const startxref = `startxref\n${xrefStreamObjOffset}\n%%EOF\n`;

  // 组装
  const totalLen = header.length + obj1.length + obj2.length + obj3.length + streamObjLen + startxref.length;
  const result = new Uint8Array(totalLen);
  let off = 0;
  for (const part of [encodeUtf8(header), encodeUtf8(obj1), encodeUtf8(obj2), encodeUtf8(obj3), ...streamObjParts, encodeUtf8(startxref)]) {
    result.set(part, off);
    off += part.length;
  }

  return result;
}

describe('PDFParser', () => {
  it('解析完整 PDF 结构', async () => {
    const data = buildMinimalPDF();
    const result = await PDFParser.parse(data);

    expect(result.trailer.size).toBe(4);
    expect(result.trailer.root).toEqual({ objNum: 1, genNum: 0 });
    expect(result.trailer.info).toEqual({ objNum: 3, genNum: 0 });
    expect(result.xref.entries.size).toBe(4);
  });

  it('解析 Info Dictionary', async () => {
    const data = buildMinimalPDF();
    const result = await PDFParser.parse(data);

    expect(result.info).not.toBeNull();
    expect(result.info!.get('Producer')).toBe('Test PDF Generator');
    expect(result.infoObjNum).toBe(3);
  });

  it('处理没有 Info 的 PDF', async () => {
    const data = buildPDFWithoutInfo();
    const result = await PDFParser.parse(data);

    expect(result.info).toBeNull();
    expect(result.infoObjNum).toBeNull();
  });

  it('验证 PDF 头', async () => {
    const data = encodeUtf8('Not a PDF');
    await expect(PDFParser.parse(data)).rejects.toThrow(/Invalid PDF header/);
  });

  it('查找 %%EOF 和 startxref', async () => {
    const data = buildMinimalPDF();
    const result = await PDFParser.parse(data);

    expect(result.xref.xrefOffset).toBeGreaterThan(0);
  });
});

describe('PDFParser: XRef Stream (PDF 1.5+)', () => {
  it('解析未压缩的 XRef Stream PDF', async () => {
    const data = buildXrefStreamPDF({ compress: false });
    const result = await PDFParser.parse(data);

    expect(result.trailer.size).toBe(5);
    expect(result.trailer.root).toEqual({ objNum: 1, genNum: 0 });
    expect(result.trailer.info).toEqual({ objNum: 3, genNum: 0 });
    expect(result.xref.entries.size).toBe(5);

    // 验证 xref 条目
    const obj1 = result.xref.entries.get(1)!;
    expect(obj1.inUse).toBe(true);
    expect(obj1.offset).toBeGreaterThan(0);

    // 验证 Info Dictionary
    expect(result.info).not.toBeNull();
    expect(result.info!.get('Producer')).toBe('Test PDF Generator');
  });

  it('解析压缩的 XRef Stream PDF (FlateDecode)', async () => {
    const data = buildXrefStreamPDF({ compress: true });
    const result = await PDFParser.parse(data);

    expect(result.trailer.size).toBe(5);
    expect(result.trailer.root).toEqual({ objNum: 1, genNum: 0 });
    expect(result.info).not.toBeNull();
    expect(result.info!.get('Producer')).toBe('Test PDF Generator');
  });

  it('XRef Stream PDF 无 Info Dictionary', async () => {
    // 构建无 Info 的 XRef Stream PDF
    const header = '%PDF-1.7\n';
    let pos = header.length;
    const offsets: number[] = [0];

    const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
    offsets.push(pos); pos += obj1.length;

    const obj2 = '2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n';
    offsets.push(pos); pos += obj2.length;

    // XRef Stream (object 3)
    const w: [number, number, number] = [1, 2, 1];
    const numEntries = 4;
    const xrefBytes = new Uint8Array(w[0] + w[1] + w[2]).fill(0); // not used directly
    const entrySize = 4;
    const xrefData = new Uint8Array(entrySize * numEntries);
    let idx = 0;
    xrefData[idx++] = 0; xrefData[idx++] = 0; xrefData[idx++] = 0; xrefData[idx++] = 255;
    for (let i = 1; i <= 2; i++) {
      xrefData[idx++] = 1;
      xrefData[idx++] = (offsets[i]! >> 8) & 0xff;
      xrefData[idx++] = offsets[i]! & 0xff;
      xrefData[idx++] = 0;
    }
    const xrefStreamOffset = pos;
    xrefData[idx++] = 1;
    xrefData[idx++] = (xrefStreamOffset >> 8) & 0xff;
    xrefData[idx++] = xrefStreamOffset & 0xff;
    xrefData[idx++] = 0;

    const streamObj = `3 0 obj\n<< /Type /XRef /Size ${numEntries} /Root 1 0 R /W [${w.join(' ')}] /Length ${xrefData.length} >>\nstream\n`;
    const streamEnd = '\nendstream\nendobj\n';
    const startxref = `startxref\n${xrefStreamOffset}\n%%EOF\n`;

    const total = header.length + obj1.length + obj2.length + streamObj.length + xrefData.length + streamEnd.length + startxref.length;
    const result = new Uint8Array(total);
    let off = 0;
    for (const p of [encodeUtf8(header), encodeUtf8(obj1), encodeUtf8(obj2), encodeUtf8(streamObj), xrefData, encodeUtf8(streamEnd), encodeUtf8(startxref)]) {
      result.set(p, off); off += p.length;
    }

    const parseResult = await PDFParser.parse(result);
    expect(parseResult.info).toBeNull();
    expect(parseResult.infoObjNum).toBeNull();
    expect(parseResult.trailer.size).toBe(4);
  });

  it('XRef Stream PDF 增量更新 round-trip', async () => {
    const data = buildXrefStreamPDF({ compress: false });
    const result = await PDFParser.parse(data);

    // 写入 AIGC 元数据
    const info = result.info!;
    info.setAIGC('{"Label":"AI","ContentProducer":"GPT"}');

    const updatedData = IncrementWriter.write(
      data, info, result.trailer, result.xref.entries, result.infoObjNum!,
    );

    // 重新解析（增量更新写入的是传统 xref）
    const result2 = await PDFParser.parse(updatedData);

    expect(result2.info).not.toBeNull();
    expect(result2.info!.getAIGC()).toBe('{"Label":"AI","ContentProducer":"GPT"}');
    expect(result2.info!.get('Producer')).toBe('Test PDF Generator');
    // /Prev 应指向原始 XRef Stream 偏移
    expect(result2.trailer.prev).toBe(result.xref.xrefOffset);
  });
});

describe('IncrementWriter', () => {
  it('增量更新已有 Info Dictionary', async () => {
    const originalData = buildMinimalPDF();
    const result = await PDFParser.parse(originalData);

    const info = result.info!;
    info.setAIGC('{"Label":"AI","ContentProducer":"GPT"}');

    const updatedData = IncrementWriter.write(
      originalData, info, result.trailer, result.xref.entries, result.infoObjNum!,
    );

    expect(updatedData.length).toBeGreaterThan(originalData.length);

    const result2 = await PDFParser.parse(updatedData);

    expect(result2.trailer.prev).toBe(result.xref.xrefOffset);
    expect(result2.info).not.toBeNull();
    expect(result2.info!.getAIGC()).toBe('{"Label":"AI","ContentProducer":"GPT"}');
    expect(result2.info!.get('Producer')).toBe('Test PDF Generator');

    const tail = decodeUtf8(updatedData.subarray(updatedData.length - 10));
    expect(tail).toContain('%%EOF');
  });

  it('增量更新创建新的 Info Dictionary', async () => {
    const originalData = buildPDFWithoutInfo();
    const result = await PDFParser.parse(originalData);

    const info = new InfoDictionary();
    info.setAIGC('{"Label":"New"}');

    const newObjNum = IncrementWriter.determineNewObjNum(result.infoObjNum, result.xref.entries);
    expect(newObjNum).toBe(3);

    const updatedData = IncrementWriter.write(
      originalData, info, result.trailer, result.xref.entries, newObjNum,
    );

    const result2 = await PDFParser.parse(updatedData);

    expect(result2.info).not.toBeNull();
    expect(result2.info!.getAIGC()).toBe('{"Label":"New"}');
    expect(result2.trailer.info).toEqual({ objNum: 3, genNum: 0 });
  });

  it('多次增量更新', async () => {
    const data1 = buildMinimalPDF();

    const result1 = await PDFParser.parse(data1);
    const info1 = result1.info!;
    info1.setAIGC('{"Label":"First"}');

    const data2 = IncrementWriter.write(
      data1, info1, result1.trailer, result1.xref.entries, result1.infoObjNum!,
    );

    const result2 = await PDFParser.parse(data2);
    const info2 = result2.info!;
    info2.setAIGC('{"Label":"Second"}');

    const data3 = IncrementWriter.write(
      data2, info2, result2.trailer, result2.xref.entries, result2.infoObjNum!,
    );

    const result3 = await PDFParser.parse(data3);
    expect(result3.info!.getAIGC()).toBe('{"Label":"Second"}');

    const text = decodeUtf8(data3);
    const eofCount = (text.match(/%%EOF/g) ?? []).length;
    expect(eofCount).toBeGreaterThanOrEqual(3);
  });

  it('determineNewObjNum 复用现有对象号', async () => {
    const data = buildMinimalPDF();
    const result = await PDFParser.parse(data);

    const num = IncrementWriter.determineNewObjNum(result.infoObjNum, result.xref.entries);
    expect(num).toBe(3);
  });

  it('determineNewObjNum 创建新对象号', async () => {
    const data = buildPDFWithoutInfo();
    const result = await PDFParser.parse(data);

    const num = IncrementWriter.determineNewObjNum(result.infoObjNum, result.xref.entries);
    expect(num).toBe(3);
  });
});
