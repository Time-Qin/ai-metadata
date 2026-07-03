/**
 * 集成测试：端到端全流程
 * 覆盖 DOCX/PPTX/XLSX/PDF 的完整生命周期
 */

import { describe, it, expect } from 'vitest';
import { AIGCSDK } from '@/sdk/AIGCSDK';
import { FileDetector } from '@/detector/FileDetector';
import { FileType } from '@/detector/FileType';
import { encodeUtf8 } from '@/utils/Encoding';
import { createEmptyMetadata, type AIGCMetadata } from '@/metadata/Metadata';

// === Fixtures ===

function buildMinimalPDF(): ArrayBuffer {
  const header = '%PDF-1.4\n';
  let pos = header.length;
  const offsets: number[] = [0];

  const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  offsets.push(pos); pos += obj1.length;
  const obj2 = '2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n';
  offsets.push(pos); pos += obj2.length;
  const obj3 = '3 0 obj\n<<\n  /Producer (Test PDF)\n  /CreationDate (D:20260101000000)\n>>\nendobj\n';
  offsets.push(pos); pos += obj3.length;

  const xrefOffset = pos;
  const xrefLines = ['xref', `0 ${offsets.length}`];
  xrefLines.push('0000000000 65535 f ');
  for (let i = 1; i < offsets.length; i++) {
    xrefLines.push(`${String(offsets[i]!).padStart(10, '0')} 00000 n `);
  }
  const xref = xrefLines.join('\n') + '\n';
  const trailer = `trailer\n<< /Size ${offsets.length} /Root 1 0 R /Info 3 0 R >>\n`;
  const startxref = `startxref\n${xrefOffset}\n%%EOF\n`;

  const text = header + obj1 + obj2 + obj3 + xref + trailer + startxref;
  return encodeUtf8(text).buffer.slice(0, text.length) as ArrayBuffer;
}

function buildXrefStreamPDF(): ArrayBuffer {
  const header = '%PDF-1.7\n';
  let pos = header.length;
  const offsets: number[] = [0];

  const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  offsets.push(pos); pos += obj1.length;
  const obj2 = '2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n';
  offsets.push(pos); pos += obj2.length;
  const obj3 = '3 0 obj\n<<\n  /Producer (Test PDF)\n  /CreationDate (D:20260101000000)\n>>\nendobj\n';
  offsets.push(pos); pos += obj3.length;

  // XRef Stream (object 4)
  const xrefStreamOffset = pos;
  const w: [number, number, number] = [1, 2, 1];
  const entrySize = 4;
  const numEntries = 5; // obj 0-4
  const xrefData = new Uint8Array(entrySize * numEntries);
  let idx = 0;

  // obj 0: free
  xrefData[idx++] = 0; xrefData[idx++] = 0; xrefData[idx++] = 0; xrefData[idx++] = 255;
  // obj 1-3
  for (let i = 1; i <= 3; i++) {
    xrefData[idx++] = 1;
    xrefData[idx++] = (offsets[i]! >> 8) & 0xff;
    xrefData[idx++] = offsets[i]! & 0xff;
    xrefData[idx++] = 0;
  }
  // obj 4 (stream itself)
  xrefData[idx++] = 1;
  xrefData[idx++] = (xrefStreamOffset >> 8) & 0xff;
  xrefData[idx++] = xrefStreamOffset & 0xff;
  xrefData[idx++] = 0;

  const streamDict = `<< /Type /XRef /Size ${numEntries} /Root 1 0 R /Info 3 0 R /W [${w.join(' ')}] /Length ${xrefData.length} >>`;
  const parts: Uint8Array[] = [
    encodeUtf8(header), encodeUtf8(obj1), encodeUtf8(obj2), encodeUtf8(obj3),
    encodeUtf8(`4 0 obj\n${streamDict}\nstream\n`), xrefData,
    encodeUtf8('\nendstream\nendobj\n'),
    encodeUtf8(`startxref\n${xrefStreamOffset}\n%%EOF\n`),
  ];
  const total = parts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { result.set(p, off); off += p.length; }
  return result.buffer.slice(0, result.length) as ArrayBuffer;
}

async function buildMinimalOOXML(markerFile: string): Promise<ArrayBuffer> {
  const { MiniZipWriter } = await import('@/zip/MiniZipWriter');
  const { ZipArchive } = await import('@/zip/ZipArchive');
  const { COMPRESSION_STORED, FLAG_UTF8 } = await import('@/zip/ZipConstants');
  type ZipEntry = import('@/zip/ZipEntry').ZipEntry;
  type EOCDRecord = import('@/zip/ZipEntry').EOCDRecord;

  const customXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"></Properties>`;

  const files: Array<{ name: string; content: string }> = [
    { name: '[Content_Types].xml', content: '<Types></Types>' },
    { name: markerFile, content: '<root></root>' },
    { name: 'docProps/custom.xml', content: customXml },
  ];

  const entries: ZipEntry[] = files.map(f => {
    const data = encodeUtf8(f.content);
    return {
      fileName: f.name,
      fileNameBytes: encodeUtf8(f.name),
      compressionMethod: COMPRESSION_STORED,
      compressedSize: data.length,
      uncompressedSize: data.length,
      crc32: 0,
      flags: FLAG_UTF8,
      version: 20,
      modTime: 0,
      modDate: 0,
      externalAttr: 0,
      headerOffset: 0,
      dataOffset: 0,
      extraField: new Uint8Array(0),
      dirty: true,
      newData: data,
    };
  });

  const eocd: EOCDRecord = {
    signature: 0x06054b50,
    diskNumber: 0,
    startDisk: 0,
    entriesOnDisk: entries.length,
    totalEntries: entries.length,
    cdSize: 0,
    cdOffset: 0,
    commentLength: 0,
  };

  return new MiniZipWriter(new ZipArchive(entries, eocd)).build();
}

const fullMetadata: AIGCMetadata = {
  label: 'AI-Generated',
  contentProducer: 'GPT-4',
  produceId: 'PROD-2026-001',
  reservedCode1: 'RC1-xxx',
  contentPropagator: 'Web-Browser',
  propagateId: 'PROP-2026-001',
  reservedCode2: 'RC2-yyy',
};

describe('集成测试：端到端全流程', () => {
  describe('PDF 完整生命周期', () => {
    it('add → read → has → update → read → remove → has', async () => {
      const sdk = new AIGCSDK();
      let buffer = buildMinimalPDF();

      // 1. 初始状态：无元数据
      expect(await sdk.hasMetadata(buffer)).toBe(false);
      expect(await sdk.readMetadata(buffer)).toBeNull();

      // 2. 写入元数据
      buffer = await sdk.addMetadata(buffer, fullMetadata);

      // 3. 读取验证
      expect(await sdk.hasMetadata(buffer)).toBe(true);
      const read1 = await sdk.readMetadata(buffer);
      expect(read1).toEqual(fullMetadata);

      // 4. 更新元数据
      const updated = { ...fullMetadata, label: 'Updated', contentProducer: 'Claude' };
      buffer = await sdk.addMetadata(buffer, updated);

      // 5. 读取验证更新
      const read2 = await sdk.readMetadata(buffer);
      expect(read2!.label).toBe('Updated');
      expect(read2!.contentProducer).toBe('Claude');

      // 6. 删除元数据
      buffer = await sdk.removeMetadata(buffer);

      // 7. 验证删除
      expect(await sdk.hasMetadata(buffer)).toBe(false);
      expect(await sdk.readMetadata(buffer)).toBeNull();
    });

    it('多次增量更新后 PDF 仍然有效', async () => {
      const sdk = new AIGCSDK();
      let buffer = buildMinimalPDF();

      // 连续 5 次更新
      for (let i = 0; i < 5; i++) {
        buffer = await sdk.addMetadata(buffer, {
          ...fullMetadata,
          label: `Iteration-${i}`,
        });
      }

      const read = await sdk.readMetadata(buffer);
      expect(read!.label).toBe('Iteration-4');
    });

    it('XRef Stream PDF: add → read → has → update → remove → has', async () => {
      const sdk = new AIGCSDK();
      let buffer = buildXrefStreamPDF();

      // 初始状态：无元数据
      expect(await sdk.hasMetadata(buffer)).toBe(false);

      // 写入元数据
      buffer = await sdk.addMetadata(buffer, fullMetadata);

      // 读取验证
      expect(await sdk.hasMetadata(buffer)).toBe(true);
      const read1 = await sdk.readMetadata(buffer);
      expect(read1).toEqual(fullMetadata);

      // 更新元数据
      const updated = { ...fullMetadata, label: 'XRef-Updated' };
      buffer = await sdk.addMetadata(buffer, updated);
      const read2 = await sdk.readMetadata(buffer);
      expect(read2!.label).toBe('XRef-Updated');

      // 删除元数据
      buffer = await sdk.removeMetadata(buffer);
      expect(await sdk.hasMetadata(buffer)).toBe(false);
    });

    it('XRef Stream PDF: 多次增量更新后可读', async () => {
      const sdk = new AIGCSDK();
      let buffer = buildXrefStreamPDF();

      for (let i = 0; i < 3; i++) {
        buffer = await sdk.addMetadata(buffer, {
          ...fullMetadata,
          label: `XRefIter-${i}`,
        });
      }

      const read = await sdk.readMetadata(buffer);
      expect(read!.label).toBe('XRefIter-2');
    });
  });

  describe('DOCX 完整生命周期', () => {
    it('add → read → has → remove → has', async () => {
      const sdk = new AIGCSDK();
      let buffer = await buildMinimalOOXML('word/document.xml');

      // 验证文件类型检测
      expect(FileDetector.detect(buffer)).toBe(FileType.DOCX);

      // 初始状态
      expect(await sdk.hasMetadata(buffer)).toBe(false);

      // 写入
      buffer = await sdk.addMetadata(buffer, fullMetadata);
      expect(await sdk.hasMetadata(buffer)).toBe(true);

      // 读取
      const read = await sdk.readMetadata(buffer);
      expect(read).toEqual(fullMetadata);

      // 删除
      buffer = await sdk.removeMetadata(buffer);
      expect(await sdk.hasMetadata(buffer)).toBe(false);
    });
  });

  describe('PPTX 完整生命周期', () => {
    it('add → read → remove', async () => {
      const sdk = new AIGCSDK();
      let buffer = await buildMinimalOOXML('ppt/presentation.xml');

      expect(FileDetector.detect(buffer)).toBe(FileType.PPTX);

      buffer = await sdk.addMetadata(buffer, fullMetadata);
      const read = await sdk.readMetadata(buffer);
      expect(read).toEqual(fullMetadata);

      buffer = await sdk.removeMetadata(buffer);
      expect(await sdk.hasMetadata(buffer)).toBe(false);
    });
  });

  describe('XLSX 完整生命周期', () => {
    it('add → read → remove', async () => {
      const sdk = new AIGCSDK();
      let buffer = await buildMinimalOOXML('xl/workbook.xml');

      expect(FileDetector.detect(buffer)).toBe(FileType.XLSX);

      buffer = await sdk.addMetadata(buffer, fullMetadata);
      const read = await sdk.readMetadata(buffer);
      expect(read).toEqual(fullMetadata);

      buffer = await sdk.removeMetadata(buffer);
      expect(await sdk.hasMetadata(buffer)).toBe(false);
    });
  });

  describe('跨格式一致性', () => {
    it('相同元数据在 PDF 和 DOCX 中读取结果一致', async () => {
      const sdk = new AIGCSDK();
      const pdfBuffer = buildMinimalPDF();
      const docxBuffer = await buildMinimalOOXML('word/document.xml');

      const pdfResult = await sdk.addMetadata(pdfBuffer, fullMetadata);
      const docxResult = await sdk.addMetadata(docxBuffer, fullMetadata);

      const pdfRead = await sdk.readMetadata(pdfResult);
      const docxRead = await sdk.readMetadata(docxResult);

      expect(pdfRead).toEqual(docxRead);
      expect(pdfRead).toEqual(fullMetadata);
    });

    it('空元数据在两种格式中一致', async () => {
      const sdk = new AIGCSDK();
      const pdfBuffer = buildMinimalPDF();
      const docxBuffer = await buildMinimalOOXML('word/document.xml');

      const empty = createEmptyMetadata();

      const pdfResult = await sdk.addMetadata(pdfBuffer, empty);
      const docxResult = await sdk.addMetadata(docxBuffer, empty);

      const pdfRead = await sdk.readMetadata(pdfResult);
      const docxRead = await sdk.readMetadata(docxResult);

      expect(pdfRead).toEqual(docxRead);
    });
  });

  describe('边界情况', () => {
    it('空元数据写入和读取', async () => {
      const sdk = new AIGCSDK();
      let buffer = buildMinimalPDF();

      buffer = await sdk.addMetadata(buffer, createEmptyMetadata());
      const read = await sdk.readMetadata(buffer);

      expect(read).not.toBeNull();
      expect(read!.label).toBe('');
      expect(read!.contentProducer).toBe('');
    });

    it('特殊字符元数据', async () => {
      const sdk = new AIGCSDK();
      let buffer = buildMinimalPDF();

      const special: AIGCMetadata = {
        label: '特殊字符: <>"&\\()',
        contentProducer: '中文测试',
        produceId: 'ID-with-special chars',
        reservedCode1: '',
        contentPropagator: 'Tab\tNewline\n',
        propagateId: '',
        reservedCode2: '',
      };

      buffer = await sdk.addMetadata(buffer, special);
      const read = await sdk.readMetadata(buffer);

      expect(read).toEqual(special);
    });

    it('长字符串元数据', async () => {
      const sdk = new AIGCSDK();
      let buffer = buildMinimalPDF();

      const longStr = 'A'.repeat(1000);
      const longMeta: AIGCMetadata = {
        ...createEmptyMetadata(),
        label: longStr,
        contentProducer: longStr,
      };

      buffer = await sdk.addMetadata(buffer, longMeta);
      const read = await sdk.readMetadata(buffer);

      expect(read!.label).toBe(longStr);
      expect(read!.contentProducer).toBe(longStr);
    });
  });
});
