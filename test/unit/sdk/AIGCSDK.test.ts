import { describe, it, expect } from 'vitest';
import { AIGCSDK } from '@/sdk/AIGCSDK';
import { encodeUtf8, decodeUtf8 } from '@/utils/Encoding';
import { createEmptyMetadata, type AIGCMetadata } from '@/metadata/Metadata';
import { UnsupportedFileError } from '@/errors/UnsupportedFileError';
import { MetadataError } from '@/errors/MetadataError';

// === PDF Fixtures ===

function buildMinimalPDF(): ArrayBuffer {
  const header = '%PDF-1.4\n';
  let pos = header.length;
  const offsets: number[] = [0];

  const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  offsets.push(pos); pos += obj1.length;

  const obj2 = '2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n';
  offsets.push(pos); pos += obj2.length;

  const obj3 = '3 0 obj\n<<\n  /Producer (Test PDF)\n>>\nendobj\n';
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

  return encodeUtf8(header + obj1 + obj2 + obj3 + xref + trailer + startxref).buffer.slice(0, (header + obj1 + obj2 + obj3 + xref + trailer + startxref).length) as ArrayBuffer;
}

// === OOXML (DOCX) Fixtures ===

async function buildMinimalDocx(): Promise<ArrayBuffer> {
  const { MiniZipWriter } = await import('@/zip/MiniZipWriter');
  const { ZipArchive } = await import('@/zip/ZipArchive');
  const { COMPRESSION_STORED, FLAG_UTF8 } = await import('@/zip/ZipConstants');
  type ZipEntry = import('@/zip/ZipEntry').ZipEntry;
  type EOCDRecord = import('@/zip/ZipEntry').EOCDRecord;

  const customXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"></Properties>`;

  const files: Array<{ name: string; content: string }> = [
    { name: '[Content_Types].xml', content: '<Types></Types>' },
    { name: 'word/document.xml', content: '<document></document>' },
    { name: 'docProps/custom.xml', content: customXml },
  ];

  const entries: ZipEntry[] = files.map(f => {
    const fileNameBytes = encodeUtf8(f.name);
    const data = encodeUtf8(f.content);
    return {
      fileName: f.name,
      fileNameBytes,
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

  const emptyEocd: EOCDRecord = {
    signature: 0x06054b50,
    diskNumber: 0,
    startDisk: 0,
    entriesOnDisk: entries.length,
    totalEntries: entries.length,
    cdSize: 0,
    cdOffset: 0,
    commentLength: 0,
  };

  const archive = new ZipArchive(entries, emptyEocd);
  const writer = new MiniZipWriter(archive);
  return writer.build();
}

const sampleMetadata: AIGCMetadata = {
  label: 'AI',
  contentProducer: 'ChatGPT',
  produceId: 'ID-001',
  reservedCode1: '',
  contentPropagator: 'web',
  propagateId: 'ID-002',
  reservedCode2: '',
};

describe('AIGCSDK', () => {
  describe('PDF 文件', () => {
    it('addMetadata + readMetadata 往返', async () => {
      const sdk = new AIGCSDK();
      const pdfBuffer = buildMinimalPDF();

      const updatedBuffer = await sdk.addMetadata(pdfBuffer, sampleMetadata);
      expect(updatedBuffer).toBeInstanceOf(ArrayBuffer);
      expect(updatedBuffer.byteLength).toBeGreaterThan(pdfBuffer.byteLength);

      const read = await sdk.readMetadata(updatedBuffer);
      expect(read).not.toBeNull();
      expect(read!.label).toBe('AI');
      expect(read!.contentProducer).toBe('ChatGPT');
      expect(read!.produceId).toBe('ID-001');
    });

    it('hasMetadata 检测', async () => {
      const sdk = new AIGCSDK();
      const pdfBuffer = buildMinimalPDF();

      expect(await sdk.hasMetadata(pdfBuffer)).toBe(false);

      const updated = await sdk.addMetadata(pdfBuffer, sampleMetadata);
      expect(await sdk.hasMetadata(updated)).toBe(true);
    });

    it('removeMetadata 删除', async () => {
      const sdk = new AIGCSDK();
      const pdfBuffer = buildMinimalPDF();

      const withMeta = await sdk.addMetadata(pdfBuffer, sampleMetadata);
      expect(await sdk.hasMetadata(withMeta)).toBe(true);

      const withoutMeta = await sdk.removeMetadata(withMeta);
      expect(await sdk.hasMetadata(withoutMeta)).toBe(false);
    });

    it('readMetadata 不存在时返回 null', async () => {
      const sdk = new AIGCSDK();
      const pdfBuffer = buildMinimalPDF();
      expect(await sdk.readMetadata(pdfBuffer)).toBeNull();
    });
  });

  describe('OOXML (DOCX) 文件', () => {
    it('addMetadata + readMetadata 往返', async () => {
      const sdk = new AIGCSDK();
      const docxBuffer = await buildMinimalDocx();

      const updatedBuffer = await sdk.addMetadata(docxBuffer, sampleMetadata);
      expect(updatedBuffer).toBeInstanceOf(ArrayBuffer);

      const read = await sdk.readMetadata(updatedBuffer);
      expect(read).not.toBeNull();
      expect(read!.label).toBe('AI');
      expect(read!.contentProducer).toBe('ChatGPT');
    });

    it('hasMetadata 检测', async () => {
      const sdk = new AIGCSDK();
      const docxBuffer = await buildMinimalDocx();

      expect(await sdk.hasMetadata(docxBuffer)).toBe(false);

      const updated = await sdk.addMetadata(docxBuffer, sampleMetadata);
      expect(await sdk.hasMetadata(updated)).toBe(true);
    });

    it('removeMetadata 删除', async () => {
      const sdk = new AIGCSDK();
      const docxBuffer = await buildMinimalDocx();

      const withMeta = await sdk.addMetadata(docxBuffer, sampleMetadata);
      expect(await sdk.hasMetadata(withMeta)).toBe(true);

      const withoutMeta = await sdk.removeMetadata(withMeta);
      expect(await sdk.hasMetadata(withoutMeta)).toBe(false);
    });
  });

  describe('validateMetadata', () => {
    it('合法元数据返回 true', () => {
      const sdk = new AIGCSDK();
      expect(sdk.validateMetadata(sampleMetadata)).toBe(true);
    });

    it('空元数据返回 true（字段全在且为 string）', () => {
      const sdk = new AIGCSDK();
      expect(sdk.validateMetadata(createEmptyMetadata())).toBe(true);
    });

    it('缺少字段返回 false', () => {
      const sdk = new AIGCSDK();
      const invalid = { label: 'AI' } as unknown as AIGCMetadata;
      expect(sdk.validateMetadata(invalid)).toBe(false);
    });

    it('字段类型错误返回 false', () => {
      const sdk = new AIGCSDK();
      const invalid = { ...sampleMetadata, label: 123 } as unknown as AIGCMetadata;
      expect(sdk.validateMetadata(invalid)).toBe(false);
    });
  });

  describe('错误处理', () => {
    it('不支持的文件类型抛出异常', async () => {
      const sdk = new AIGCSDK();
      const textBuffer = encodeUtf8('Hello World').buffer.slice(0, 11) as ArrayBuffer;

      await expect(sdk.addMetadata(textBuffer, sampleMetadata)).rejects.toThrow(UnsupportedFileError);
    });

    it('strictMode 下非法元数据抛出异常', async () => {
      const sdk = new AIGCSDK({ strictMode: true });
      const pdfBuffer = buildMinimalPDF();
      const invalid = { label: 'AI' } as unknown as AIGCMetadata;

      await expect(sdk.addMetadata(pdfBuffer, invalid)).rejects.toThrow(MetadataError);
    });

    it('非 strictMode 下非法元数据也抛出异常', async () => {
      const sdk = new AIGCSDK();
      const pdfBuffer = buildMinimalPDF();
      const invalid = { label: 'AI' } as unknown as AIGCMetadata;

      await expect(sdk.addMetadata(pdfBuffer, invalid)).rejects.toThrow(MetadataError);
    });
  });

  describe('跨格式一致性', () => {
    it('PDF 和 DOCX 写入相同元数据后读取结果一致', async () => {
      const sdk = new AIGCSDK();
      const pdfBuffer = buildMinimalPDF();
      const docxBuffer = await buildMinimalDocx();

      const pdfResult = await sdk.addMetadata(pdfBuffer, sampleMetadata);
      const docxResult = await sdk.addMetadata(docxBuffer, sampleMetadata);

      const pdfRead = await sdk.readMetadata(pdfResult);
      const docxRead = await sdk.readMetadata(docxResult);

      expect(pdfRead).toEqual(docxRead);
    });
  });
});
