import { describe, it, expect } from 'vitest';
import { FileDetector } from '@/detector/FileDetector';
import { FileType } from '@/detector/FileType';
import { MiniZipWriter } from '@/zip/MiniZipWriter';
import { ZipArchive } from '@/zip/ZipArchive';
import { EOCDRecord, ZipEntry } from '@/zip/ZipEntry';
import { encodeUtf8 } from '@/utils/Encoding';
import { COMPRESSION_STORED, FLAG_UTF8 } from '@/zip/ZipConstants';

/**
 * 构建一个包含指定文件的最小 ZIP
 */
async function buildZipWithFiles(fileNames: string[]): Promise<Uint8Array> {
  const entries: ZipEntry[] = [];
  for (const fileName of fileNames) {
    const fileNameBytes = encodeUtf8(fileName);
    const data = encodeUtf8(`<root>${fileName}</root>`);
    entries.push({
      fileName,
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
    });
  }

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
  const buffer = await writer.build();
  return new Uint8Array(buffer);
}

describe('FileDetector', () => {
  it('检测 PDF', () => {
    const pdfData = encodeUtf8('%PDF-1.4\nrest of pdf...');
    expect(FileDetector.detect(pdfData)).toBe(FileType.PDF);
  });

  it('检测 DOCX', async () => {
    const zipData = await buildZipWithFiles([
      '[Content_Types].xml',
      'word/document.xml',
      'docProps/custom.xml',
    ]);
    expect(FileDetector.detect(zipData)).toBe(FileType.DOCX);
  });

  it('检测 PPTX', async () => {
    const zipData = await buildZipWithFiles([
      '[Content_Types].xml',
      'ppt/presentation.xml',
      'docProps/custom.xml',
    ]);
    expect(FileDetector.detect(zipData)).toBe(FileType.PPTX);
  });

  it('检测 XLSX', async () => {
    const zipData = await buildZipWithFiles([
      '[Content_Types].xml',
      'xl/workbook.xml',
      'docProps/custom.xml',
    ]);
    expect(FileDetector.detect(zipData)).toBe(FileType.XLSX);
  });

  it('普通 ZIP 返回 UNKNOWN', async () => {
    const zipData = await buildZipWithFiles(['hello.txt', 'world.txt']);
    expect(FileDetector.detect(zipData)).toBe(FileType.UNKNOWN);
  });

  it('未知文件类型返回 UNKNOWN', () => {
    const data = encodeUtf8('Hello World this is not a known format');
    expect(FileDetector.detect(data)).toBe(FileType.UNKNOWN);
  });

  it('空文件抛出异常', () => {
    expect(() => FileDetector.detect(new Uint8Array(0))).toThrow(/too small/i);
  });

  it('小于 4 字节的文件抛出异常', () => {
    expect(() => FileDetector.detect(new Uint8Array([0x50, 0x4b]))).toThrow(/too small/i);
  });

  it('接受 ArrayBuffer 输入', () => {
    const pdfData = encodeUtf8('%PDF-1.4\n');
    const buffer = pdfData.buffer.slice(0, pdfData.byteLength);
    expect(FileDetector.detect(buffer)).toBe(FileType.PDF);
  });

  it('接受 Uint8Array 输入', () => {
    const pdfData = encodeUtf8('%PDF-1.4\n');
    expect(FileDetector.detect(pdfData)).toBe(FileType.PDF);
  });
});
