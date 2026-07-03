import { describe, it, expect } from 'vitest';
import { OOXMLMetadataEditor } from '@/ooxml/OOXMLMetadataEditor';
import { MiniZipWriter } from '@/zip/MiniZipWriter';
import { ZipArchive } from '@/zip/ZipArchive';
import type { ZipEntry, EOCDRecord } from '@/zip/ZipEntry';
import { encodeUtf8, decodeUtf8 } from '@/utils/Encoding';
import { COMPRESSION_STORED, FLAG_UTF8 } from '@/zip/ZipConstants';
import { createEmptyMetadata } from '@/metadata/Metadata';

/**
 * 构建包含 custom.xml 的最小 DOCX ZIP
 */
async function buildDocxWithCustomXml(customXmlContent?: string): Promise<Uint8Array> {
  const customXml = customXmlContent ?? `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"></Properties>`;

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
  const buffer = await writer.build();
  return new Uint8Array(buffer);
}

/**
 * 构建没有 custom.xml 的 DOCX ZIP
 */
async function buildDocxWithoutCustomXml(): Promise<Uint8Array> {
  const files: Array<{ name: string; content: string }> = [
    { name: '[Content_Types].xml', content: '<Types></Types>' },
    { name: 'word/document.xml', content: '<document></document>' },
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
  const buffer = await writer.build();
  return new Uint8Array(buffer);
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

describe('OOXMLMetadataEditor', () => {
  it('写入和读取元数据', async () => {
    const zipData = await buildDocxWithCustomXml();
    const editor = new OOXMLMetadataEditor(zipData);

    await editor.write(sampleMetadata);

    const result = editor.getResult();
    const editor2 = new OOXMLMetadataEditor(result);
    const read = await editor2.read();

    expect(read).not.toBeNull();
    expect(read!.label).toBe('AI');
    expect(read!.contentProducer).toBe('ChatGPT');
    expect(read!.produceId).toBe('ID-001');
    expect(read!.contentPropagator).toBe('web');
    expect(read!.propagateId).toBe('ID-002');
  });

  it('检测元数据是否存在', async () => {
    const zipData = await buildDocxWithCustomXml();
    const editor = new OOXMLMetadataEditor(zipData);

    expect(await editor.has()).toBe(false);

    await editor.write(sampleMetadata);
    const editor2 = new OOXMLMetadataEditor(editor.getResult());
    expect(await editor2.has()).toBe(true);
  });

  it('删除元数据', async () => {
    const zipData = await buildDocxWithCustomXml();
    const editor = new OOXMLMetadataEditor(zipData);
    await editor.write(sampleMetadata);

    const editor2 = new OOXMLMetadataEditor(editor.getResult());
    expect(await editor2.has()).toBe(true);

    await editor2.remove();
    const editor3 = new OOXMLMetadataEditor(editor2.getResult());
    expect(await editor3.has()).toBe(false);
  });

  it('读取不存在的元数据返回 null', async () => {
    const zipData = await buildDocxWithCustomXml();
    const editor = new OOXMLMetadataEditor(zipData);

    const result = await editor.read();
    expect(result).toBeNull();
  });

  it('处理没有 custom.xml 的文件', async () => {
    const zipData = await buildDocxWithoutCustomXml();
    const editor = new OOXMLMetadataEditor(zipData);

    expect(await editor.has()).toBe(false);
    expect(await editor.read()).toBeNull();

    // 写入会创建 custom.xml
    await editor.write(sampleMetadata);
    const editor2 = new OOXMLMetadataEditor(editor.getResult());
    expect(await editor2.has()).toBe(true);

    const read = await editor2.read();
    expect(read!.label).toBe('AI');
  });

  it('覆盖更新已有元数据', async () => {
    const zipData = await buildDocxWithCustomXml();
    const editor = new OOXMLMetadataEditor(zipData);
    await editor.write(sampleMetadata);

    const updatedMetadata = { ...sampleMetadata, label: 'Human', contentProducer: 'User' };
    const editor2 = new OOXMLMetadataEditor(editor.getResult());
    await editor2.write(updatedMetadata);

    const editor3 = new OOXMLMetadataEditor(editor2.getResult());
    const read = await editor3.read();

    expect(read!.label).toBe('Human');
    expect(read!.contentProducer).toBe('User');
  });

  it('处理空元数据', async () => {
    const zipData = await buildDocxWithCustomXml();
    const editor = new OOXMLMetadataEditor(zipData);
    await editor.write(createEmptyMetadata());

    const editor2 = new OOXMLMetadataEditor(editor.getResult());
    const read = await editor2.read();

    expect(read).not.toBeNull();
    expect(read!.label).toBe('');
    expect(read!.contentProducer).toBe('');
  });
});
