import { describe, it, expect } from 'vitest';
import { XrefStreamParser } from '@/pdf/XrefStreamParser';
import { encodeUtf8 } from '@/utils/Encoding';
import { deflateSync, deflateRawSync } from 'node:zlib';

/**
 * 构建二进制 xref 条目数据
 */
function buildXrefEntries(
  entries: Array<{ type: number; field2: number; field3: number }>,
  widths: [number, number, number],
): Uint8Array {
  const entrySize = widths[0] + widths[1] + widths[2];
  const data = new Uint8Array(entrySize * entries.length);
  let offset = 0;

  for (const entry of entries) {
    if (widths[0] > 0) {
      writeUIntBE(data, offset, widths[0], entry.type);
      offset += widths[0];
    }
    if (widths[1] > 0) {
      writeUIntBE(data, offset, widths[1], entry.field2);
      offset += widths[1];
    }
    if (widths[2] > 0) {
      writeUIntBE(data, offset, widths[2], entry.field3);
      offset += widths[2];
    }
  }

  return data;
}

function writeUIntBE(data: Uint8Array, offset: number, width: number, value: number): void {
  for (let i = width - 1; i >= 0; i--) {
    data[offset + i] = value & 0xff;
    value = Math.floor(value / 256);
  }
}

/**
 * 构建包含 XRef Stream 的完整 PDF
 */
function buildXrefStreamPDF(opts: {
  widths?: [number, number, number];
  compress?: boolean;
  indexArray?: number[];
  numObjects?: number;
  infoObjNum?: number;
  filterAsArray?: boolean;
}): Uint8Array {
  const {
    widths = [1, 2, 1],
    compress = false,
    indexArray,
    filterAsArray = false,
  } = opts;

  const header = '%PDF-1.7\n';
  let pos = header.length;
  const offsets: number[] = [0]; // obj 0 (free)

  // Object 1: Catalog
  const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  offsets.push(pos); pos += obj1.length;

  // Object 2: Pages
  const obj2 = '2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n';
  offsets.push(pos); pos += obj2.length;

  // Object 3: Info
  const obj3 = '3 0 obj\n<< /Producer (Test) >>\nendobj\n';
  offsets.push(pos); pos += obj3.length;

  // 构建 xref 条目 (obj 0-3 + stream object itself)
  const xrefStreamOffset = pos;
  const allOffsets = [...offsets, xrefStreamOffset]; // obj 4 = stream
  const numEntries = allOffsets.length;

  const entries = allOffsets.map((off, i) => ({
    type: i === 0 ? 0 : 1,
    field2: off,
    field3: i === 0 ? 255 : 0,
  }));

  let streamData = buildXrefEntries(entries, widths);

  let filterStr = '';
  if (compress) {
    streamData = new Uint8Array(deflateSync(streamData));
    filterStr = filterAsArray ? ' /Filter [/FlateDecode]' : ' /Filter /FlateDecode';
  }

  let indexStr = '';
  if (indexArray) {
    indexStr = ` /Index [${indexArray.join(' ')}]`;
  }

  const streamDict = `<< /Type /XRef /Size ${numEntries} /Root 1 0 R /Info 3 0 R /W [${widths.join(' ')}] /Length ${streamData.length}${filterStr}${indexStr} >>`;

  const parts: Uint8Array[] = [
    encodeUtf8(header),
    encodeUtf8(obj1),
    encodeUtf8(obj2),
    encodeUtf8(obj3),
    encodeUtf8(`4 0 obj\n${streamDict}\nstream\n`),
    streamData,
    encodeUtf8('\nendstream\nendobj\n'),
    encodeUtf8(`startxref\n${xrefStreamOffset}\n%%EOF\n`),
  ];

  const total = parts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    result.set(p, off);
    off += p.length;
  }
  return result;
}

describe('XrefStreamParser', () => {
  describe('isXrefStream', () => {
    it('检测传统 xref 表 → false', () => {
      const data = encodeUtf8('xref\n0 2\n');
      expect(XrefStreamParser.isXrefStream(data, 0)).toBe(false);
    });

    it('检测间接对象 → true', () => {
      const data = encodeUtf8('750 0 obj\n<< >>\nendobj\n');
      expect(XrefStreamParser.isXrefStream(data, 0)).toBe(true);
    });

    it('跳过前导空白后检测', () => {
      const data = encodeUtf8('\n\n  5 0 obj\n');
      expect(XrefStreamParser.isXrefStream(data, 0)).toBe(true);
    });

    it('前导空白后是 xref → false', () => {
      const data = encodeUtf8('\n  xref\n');
      expect(XrefStreamParser.isXrefStream(data, 0)).toBe(false);
    });
  });

  describe('parse: 基本功能', () => {
    it('解析未压缩的 XRef Stream', async () => {
      const data = buildXrefStreamPDF({ compress: false });

      // 找到 startxref 值
      const text = new TextDecoder().decode(data);
      const startxrefMatch = text.match(/startxref\s+(\d+)/);
      const offset = parseInt(startxrefMatch![1]!, 10);

      const result = await XrefStreamParser.parse(data, offset);

      expect(result.xref.entries.size).toBe(5);
      expect(result.trailer.size).toBe(5);
      expect(result.trailer.root).toEqual({ objNum: 1, genNum: 0 });
      expect(result.trailer.info).toEqual({ objNum: 3, genNum: 0 });

      // 验证条目
      const obj1 = result.xref.entries.get(1)!;
      expect(obj1.inUse).toBe(true);
      expect(obj1.offset).toBeGreaterThan(0);
      expect(obj1.generation).toBe(0);

      const obj0 = result.xref.entries.get(0)!;
      expect(obj0.inUse).toBe(false);
    });

    it('解析压缩的 XRef Stream (FlateDecode)', async () => {
      const data = buildXrefStreamPDF({ compress: true });
      const text = new TextDecoder().decode(data);
      const offset = parseInt(text.match(/startxref\s+(\d+)/)![1]!, 10);

      const result = await XrefStreamParser.parse(data, offset);

      expect(result.xref.entries.size).toBe(5);
      expect(result.trailer.root).toEqual({ objNum: 1, genNum: 0 });
    });

    it('解析 /Filter 数组形式 [/FlateDecode]', async () => {
      const data = buildXrefStreamPDF({ compress: true, filterAsArray: true });
      const text = new TextDecoder().decode(data);
      const offset = parseInt(text.match(/startxref\s+(\d+)/)![1]!, 10);

      const result = await XrefStreamParser.parse(data, offset);
      expect(result.xref.entries.size).toBe(5);
    });

    it('压缩的 XRef Stream 使用 zlib 格式 (PDF /FlateDecode 标准)', async () => {
      // PDF /FlateDecode 使用 zlib 格式 (RFC 1950)，不是 raw DEFLATE
      // buildXrefStreamPDF 使用 deflateSync (zlib) 模拟真实 PDF
      const data = buildXrefStreamPDF({ compress: true });
      const text = new TextDecoder().decode(data);
      const offset = parseInt(text.match(/startxref\s+(\d+)/)![1]!, 10);

      const result = await XrefStreamParser.parse(data, offset);
      expect(result.xref.entries.size).toBe(5);
      expect(result.trailer.root).toEqual({ objNum: 1, genNum: 0 });
    });
  });

  describe('parse: 字段宽度', () => {
    it('W=[1 3 1] 大偏移字段', async () => {
      const data = buildXrefStreamPDF({ widths: [1, 3, 1], compress: false });
      const text = new TextDecoder().decode(data);
      const offset = parseInt(text.match(/startxref\s+(\d+)/)![1]!, 10);

      const result = await XrefStreamParser.parse(data, offset);
      expect(result.xref.entries.size).toBe(5);
      expect(result.xref.entries.get(1)!.offset).toBeGreaterThan(0);
    });

    it('W=[1 4 1] 4 字节偏移', async () => {
      const data = buildXrefStreamPDF({ widths: [1, 4, 1], compress: false });
      const text = new TextDecoder().decode(data);
      const offset = parseInt(text.match(/startxref\s+(\d+)/)![1]!, 10);

      const result = await XrefStreamParser.parse(data, offset);
      expect(result.xref.entries.size).toBe(5);
      expect(result.xref.entries.get(1)!.offset).toBeGreaterThan(0);
    });

    it('W=[0 2 1] type 宽度为 0 (默认 type 1)', async () => {
      // 当 w1=0 时，type 字段不占空间，默认值为前一个条目的 type（初始为 1）
      const header = '%PDF-1.7\n';
      let pos = header.length;
      const offsets: number[] = [0];

      const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
      offsets.push(pos); pos += obj1.length;

      const obj2 = '2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n';
      offsets.push(pos); pos += obj2.length;

      const xrefStreamOffset = pos;
      const allOffsets = [...offsets, xrefStreamOffset];
      const widths: [number, number, number] = [0, 2, 1];
      const entrySize = 3; // 0+2+1

      const streamData = new Uint8Array(entrySize * allOffsets.length);
      let idx = 0;
      for (let i = 0; i < allOffsets.length; i++) {
        // 不写 type (w1=0)
        streamData[idx++] = (allOffsets[i]! >> 8) & 0xff;
        streamData[idx++] = allOffsets[i]! & 0xff;
        streamData[idx++] = i === 0 ? 255 : 0;
      }

      const streamObj = `3 0 obj\n<< /Type /XRef /Size ${allOffsets.length} /Root 1 0 R /W [0 2 1] /Length ${streamData.length} >>\nstream\n`;
      const streamEnd = '\nendstream\nendobj\n';
      const startxref = `startxref\n${xrefStreamOffset}\n%%EOF\n`;

      const parts = [encodeUtf8(header), encodeUtf8(obj1), encodeUtf8(obj2), encodeUtf8(streamObj), streamData, encodeUtf8(streamEnd), encodeUtf8(startxref)];
      const total = parts.reduce((s, p) => s + p.length, 0);
      const data = new Uint8Array(total);
      let off = 0;
      for (const p of parts) { data.set(p, off); off += p.length; }

      const result = await XrefStreamParser.parse(data, xrefStreamOffset);
      // 第一个条目 type 默认为 1（因为 w1=0，prevType 初始为 1）
      // 所以 obj 0 也是 inUse=true，这是预期的行为（w1=0 时所有条目 type 相同）
      expect(result.xref.entries.size).toBeGreaterThanOrEqual(3);
    });
  });

  describe('parse: /Index 数组', () => {
    it('自定义 /Index 映射', async () => {
      // /Index [0 1 10 2] — entry 0 → obj 0, entries 1-2 → obj 10-11
      const header = '%PDF-1.7\n';
      let pos = header.length;
      const offsets: number[] = [0];

      const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
      offsets.push(pos); pos += obj1.length;

      const obj2 = '2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n';
      offsets.push(pos); pos += obj2.length;

      const xrefStreamOffset = pos;
      // 3 entries: obj 0 (free), obj 10, obj 11
      const widths: [number, number, number] = [1, 2, 1];
      const entrySize = 4;
      const streamData = new Uint8Array(entrySize * 3);
      let idx = 0;

      // Entry for obj 0 (free)
      streamData[idx++] = 0; streamData[idx++] = 0; streamData[idx++] = 0; streamData[idx++] = 255;
      // Entry for obj 10
      streamData[idx++] = 1; streamData[idx++] = (offsets[1]! >> 8) & 0xff; streamData[idx++] = offsets[1]! & 0xff; streamData[idx++] = 0;
      // Entry for obj 11
      streamData[idx++] = 1; streamData[idx++] = (offsets[2]! >> 8) & 0xff; streamData[idx++] = offsets[2]! & 0xff; streamData[idx++] = 0;

      const streamObj = `3 0 obj\n<< /Type /XRef /Size 12 /Root 1 0 R /W [${widths.join(' ')}] /Length ${streamData.length} /Index [0 1 10 2] >>\nstream\n`;
      const streamEnd = '\nendstream\nendobj\n';
      const startxref = `startxref\n${xrefStreamOffset}\n%%EOF\n`;

      const parts = [encodeUtf8(header), encodeUtf8(obj1), encodeUtf8(obj2), encodeUtf8(streamObj), streamData, encodeUtf8(streamEnd), encodeUtf8(startxref)];
      const total = parts.reduce((s, p) => s + p.length, 0);
      const data = new Uint8Array(total);
      let off = 0;
      for (const p of parts) { data.set(p, off); off += p.length; }

      const result = await XrefStreamParser.parse(data, xrefStreamOffset);

      expect(result.xref.entries.has(0)).toBe(true);
      expect(result.xref.entries.has(10)).toBe(true);
      expect(result.xref.entries.has(11)).toBe(true);
      expect(result.xref.entries.get(10)!.offset).toBe(offsets[1]);
      expect(result.xref.entries.get(11)!.offset).toBe(offsets[2]);
    });

    it('默认 /Index (无 /Index 条目)', async () => {
      const data = buildXrefStreamPDF({ compress: false });
      const text = new TextDecoder().decode(data);
      const offset = parseInt(text.match(/startxref\s+(\d+)/)![1]!, 10);

      const result = await XrefStreamParser.parse(data, offset);

      // 默认 0..Size-1
      for (let i = 0; i < 5; i++) {
        expect(result.xref.entries.has(i)).toBe(true);
      }
    });
  });

  describe('parse: 条目类型', () => {
    it('Type 0 (空闲) 条目', async () => {
      const data = buildXrefStreamPDF({ compress: false });
      const text = new TextDecoder().decode(data);
      const offset = parseInt(text.match(/startxref\s+(\d+)/)![1]!, 10);

      const result = await XrefStreamParser.parse(data, offset);

      const obj0 = result.xref.entries.get(0)!;
      expect(obj0.inUse).toBe(false);
      expect(obj0.offset).toBe(0);
    });

    it('Type 2 (压缩) 条目', async () => {
      // 构建一个包含 Type 2 条目的 XRef Stream
      const header = '%PDF-1.7\n';
      let pos = header.length;

      const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
      const obj1Off = pos; pos += obj1.length;

      const obj2 = '2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n';
      pos += obj2.length;

      const xrefStreamOffset = pos;
      const widths: [number, number, number] = [1, 2, 1];
      const entrySize = 4;
      // 3 entries: obj 0 (free), obj 1 (type 1), obj 2 (type 2 compressed)
      const streamData = new Uint8Array(entrySize * 3);
      let idx = 0;

      // obj 0: free
      streamData[idx++] = 0; streamData[idx++] = 0; streamData[idx++] = 0; streamData[idx++] = 255;
      // obj 1: type 1 (uncompressed)
      streamData[idx++] = 1; streamData[idx++] = (obj1Off >> 8) & 0xff; streamData[idx++] = obj1Off & 0xff; streamData[idx++] = 0;
      // obj 2: type 2 (compressed in obj stream 5, index 0)
      streamData[idx++] = 2; streamData[idx++] = 0; streamData[idx++] = 5; streamData[idx++] = 0;

      const streamObj = `3 0 obj\n<< /Type /XRef /Size 3 /Root 1 0 R /W [${widths.join(' ')}] /Length ${streamData.length} >>\nstream\n`;
      const streamEnd = '\nendstream\nendobj\n';
      const startxref = `startxref\n${xrefStreamOffset}\n%%EOF\n`;

      const parts = [encodeUtf8(header), encodeUtf8(obj1), encodeUtf8(obj2), encodeUtf8(streamObj), streamData, encodeUtf8(streamEnd), encodeUtf8(startxref)];
      const total = parts.reduce((s, p) => s + p.length, 0);
      const data = new Uint8Array(total);
      let off = 0;
      for (const p of parts) { data.set(p, off); off += p.length; }

      const result = await XrefStreamParser.parse(data, xrefStreamOffset);

      const obj2Entry = result.xref.entries.get(2)!;
      expect(obj2Entry.compressed).toBe(true);
      expect(obj2Entry.objStreamNum).toBe(5);
      expect(obj2Entry.indexInStream).toBe(0);
      expect(obj2Entry.offset).toBe(0);
    });
  });

  describe('parse: trailer 信息', () => {
    it('从流字典提取 trailer', async () => {
      const data = buildXrefStreamPDF({ compress: false });
      const text = new TextDecoder().decode(data);
      const offset = parseInt(text.match(/startxref\s+(\d+)/)![1]!, 10);

      const result = await XrefStreamParser.parse(data, offset);

      expect(result.trailer.size).toBe(5);
      expect(result.trailer.root).toEqual({ objNum: 1, genNum: 0 });
      expect(result.trailer.info).toEqual({ objNum: 3, genNum: 0 });
      expect(result.trailer.encrypt).toBe(false);
      expect(result.trailer.xrefOffset).toBe(offset);
    });
  });

  describe('parse: 错误处理', () => {
    it('缺少 /W 数组时报错', async () => {
      const header = '%PDF-1.7\n';
      const obj = '1 0 obj\n<< /Type /XRef /Size 1 /Root 1 0 R /Length 0 >>\nstream\n\nendstream\nendobj\n';
      const startxref = `startxref\n${header.length}\n%%EOF\n`;
      const data = encodeUtf8(header + obj + startxref);

      await expect(XrefStreamParser.parse(data, header.length)).rejects.toThrow(/\/W/);
    });

    it('缺少 /Size 报错', async () => {
      const header = '%PDF-1.7\n';
      const obj = '1 0 obj\n<< /Type /XRef /Root 1 0 R /W [1 1 1] /Length 0 >>\nstream\n\nendstream\nendobj\n';
      const startxref = `startxref\n${header.length}\n%%EOF\n`;
      const data = encodeUtf8(header + obj + startxref);

      await expect(XrefStreamParser.parse(data, header.length)).rejects.toThrow(/\/Size/);
    });

    it('不支持的 /Filter 报错', async () => {
      const header = '%PDF-1.7\n';
      const streamData = new Uint8Array(0);
      const obj = `1 0 obj\n<< /Type /XRef /Size 1 /Root 1 0 R /W [1 1 1] /Length 0 /Filter /DCTDecode >>\nstream\n\nendstream\nendobj\n`;
      const startxref = `startxref\n${header.length}\n%%EOF\n`;
      const data = encodeUtf8(header + obj + startxref);

      await expect(XrefStreamParser.parse(data, header.length)).rejects.toThrow(/Unsupported/);
    });

    it('非 /Type /XRef 报错', async () => {
      const header = '%PDF-1.7\n';
      const obj = '1 0 obj\n<< /Type /Page /Root 1 0 R /W [1 1 1] /Size 1 /Length 0 >>\nstream\n\nendstream\nendobj\n';
      const startxref = `startxref\n${header.length}\n%%EOF\n`;
      const data = encodeUtf8(header + obj + startxref);

      await expect(XrefStreamParser.parse(data, header.length)).rejects.toThrow(/XRef/);
    });
  });

  describe('parse: /Prev 链', () => {
    it('/Prev 循环防护', async () => {
      // 两个 XRef Stream 互相指向
      const header = '%PDF-1.7\n';

      // First XRef Stream at offset X, /Prev = Y
      // Second XRef Stream at offset Y, /Prev = X
      // 应该不会无限循环

      const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
      let pos = header.length + obj1.length;

      // Build first xref stream (obj 2) with /Prev pointing to second
      const widths: [number, number, number] = [1, 1, 1];
      const streamData1 = new Uint8Array([0, 0, 255, 1, header.length, 0]); // obj 0 free, obj 1 in use
      // We'll set /Prev to a fake offset (same as itself) to test loop prevention
      const streamObj1 = `2 0 obj\n<< /Type /XRef /Size 2 /Root 1 0 R /W [${widths.join(' ')}] /Length ${streamData1.length} /Prev ${pos} >>\nstream\n`;
      const streamEnd1 = '\nendstream\nendobj\n';
      const startxref = `startxref\n${pos}\n%%EOF\n`;

      const parts = [encodeUtf8(header), encodeUtf8(obj1), encodeUtf8(streamObj1), streamData1, encodeUtf8(streamEnd1), encodeUtf8(startxref)];
      const total = parts.reduce((s, p) => s + p.length, 0);
      const data = new Uint8Array(total);
      let off = 0;
      for (const p of parts) { data.set(p, off); off += p.length; }

      // Should not hang — /Prev points to itself, visited set prevents infinite loop
      const result = await XrefStreamParser.parse(data, pos);
      expect(result.xref.entries.size).toBeGreaterThanOrEqual(1);
    });
  });
});
