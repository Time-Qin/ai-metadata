/**
 * OOXML Metadata Editor
 * 实现 MetadataEditor 接口，操作 OOXML (docx/pptx/xlsx) 文件中的 AIGC 元数据
 *
 * 流程：
 * 1. 解析 ZIP 结构
 * 2. 读取/写入 docProps/custom.xml
 * 3. 重建 ZIP
 */

import type { MetadataEditor } from '@/metadata/MetadataEditor';
import type { AIGCMetadata } from '@/metadata/Metadata';
import { MetadataSerializer } from '@/metadata/MetadataSerializer';
import { MiniZipReader } from '@/zip/MiniZipReader';
import { MiniZipWriter } from '@/zip/MiniZipWriter';
import type { ZipArchive } from '@/zip/ZipArchive';
import { XMLUtils } from '@/xml/XMLUtils';
import { XMLMetadataReader } from '@/xml/XMLMetadataReader';
import { XMLMetadataWriter } from '@/xml/XMLMetadataWriter';
import { PROPERTIES_NS, VT_NS } from '@/xml/XMLNamespace';
import {
  FMTID,
  AIGC_PROPERTY_NAME,
  CUSTOM_XML_PATH,
} from '@/core/Constants';
import { encodeUtf8, decodeUtf8 } from '@/utils/Encoding';
import { ZipError } from '@/errors/ZipError';

/** custom.xml 模板 */
const CUSTOM_XML_TEMPLATE = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="${PROPERTIES_NS}" xmlns:vt="${VT_NS}"></Properties>`;

/**
 * OOXML 元数据编辑器
 */
export class OOXMLMetadataEditor implements MetadataEditor {
  private buffer: Uint8Array;
  private resultBuffer: ArrayBuffer | null = null;

  constructor(buffer: ArrayBuffer | Uint8Array) {
    this.buffer = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  }

  async read(): Promise<AIGCMetadata | null> {
    const { doc } = await this.getCustomXmlDoc();
    if (!doc) return null;

    const reader = new XMLMetadataReader(doc);
    const json = reader.getProperty(AIGC_PROPERTY_NAME);
    if (!json) return null;

    return MetadataSerializer.deserialize(json);
  }

  async write(data: AIGCMetadata): Promise<void> {
    const json = MetadataSerializer.serialize(data);

    const { archive, doc } = await this.getCustomXmlDoc();
    const document = doc ?? this.createEmptyDoc();

    const writer = new XMLMetadataWriter(document);

    // 计算 PID
    const reader = new XMLMetadataReader(document);
    const properties = reader.listProperties();
    const maxPid = properties.reduce((max, p) => Math.max(max, p.pid), 1);
    const pid = maxPid + 1;

    writer.setProperty(AIGC_PROPERTY_NAME, json, FMTID, pid);

    // 序列化 XML
    const xmlStr = XMLUtils.stringify(document);
    const xmlBytes = encodeUtf8(xmlStr);

    // 更新 ZIP
    await this.updateZipEntry(archive, xmlBytes);
  }

  async remove(): Promise<void> {
    const { archive, doc } = await this.getCustomXmlDoc();
    if (!doc) {
      // custom.xml 不存在，无需删除
      this.resultBuffer = (this.buffer.buffer as ArrayBuffer).slice(0, this.buffer.byteLength);
      return;
    }

    const writer = new XMLMetadataWriter(doc);
    writer.removeProperty(AIGC_PROPERTY_NAME);

    const xmlStr = XMLUtils.stringify(doc);
    const xmlBytes = encodeUtf8(xmlStr);

    await this.updateZipEntry(archive, xmlBytes);
  }

  async has(): Promise<boolean> {
    const { doc } = await this.getCustomXmlDoc();
    if (!doc) return false;

    const reader = new XMLMetadataReader(doc);
    return reader.getProperty(AIGC_PROPERTY_NAME) !== null;
  }

  /** 获取更新后的 buffer */
  getResult(): ArrayBuffer {
    return this.resultBuffer ?? (this.buffer.buffer as ArrayBuffer).slice(0, this.buffer.byteLength);
  }

  /**
   * 读取 ZIP 中的 custom.xml，解析为 Document
   */
  private async getCustomXmlDoc(): Promise<{ archive: ZipArchive; doc: Document | null }> {
    const reader = new MiniZipReader(this.buffer);
    const archive = reader.read();

    const entry = archive.find(CUSTOM_XML_PATH);
    if (!entry) {
      return { archive, doc: null };
    }

    const data = await reader.readEntryData(entry);
    const xmlStr = decodeUtf8(data);
    const doc = XMLUtils.parse(xmlStr);

    return { archive, doc };
  }

  /**
   * 创建空的 custom.xml Document
   */
  private createEmptyDoc(): Document {
    return XMLUtils.parse(CUSTOM_XML_TEMPLATE);
  }

  /**
   * 更新 ZIP 中的 custom.xml entry 并重建
   */
  private async updateZipEntry(archive: ZipArchive, xmlBytes: Uint8Array): Promise<void> {
    const writer = new MiniZipWriter(archive, this.buffer);

    if (archive.has(CUSTOM_XML_PATH)) {
      writer.updateEntry(CUSTOM_XML_PATH, xmlBytes);
    } else {
      writer.addEntry(CUSTOM_XML_PATH, xmlBytes);
    }

    try {
      this.resultBuffer = await writer.build();
    } catch (e) {
      throw new ZipError('ZIP_001', `Failed to rebuild ZIP: ${(e as Error).message}`);
    }
  }
}
