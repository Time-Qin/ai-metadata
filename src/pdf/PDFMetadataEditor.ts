/**
 * PDF Metadata Editor
 * 实现 MetadataEditor 接口，操作 PDF 文件中的 AIGC 元数据
 * 使用 Incremental Update 方式写入，不破坏原始 PDF 结构
 */

import type { MetadataEditor } from '@/metadata/MetadataEditor';
import type { AIGCMetadata } from '@/metadata/Metadata';
import { MetadataSerializer } from '@/metadata/MetadataSerializer';
import { PDFParser } from '@/pdf/PDFParser';
import { InfoDictionary } from '@/pdf/InfoDictionary';
import { IncrementWriter } from '@/pdf/IncrementWriter';

/**
 * PDF 元数据编辑器
 */
export class PDFMetadataEditor implements MetadataEditor {
  private buffer: Uint8Array;
  private resultBuffer: ArrayBuffer | null = null;

  constructor(buffer: ArrayBuffer | Uint8Array) {
    this.buffer = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  }

  async read(): Promise<AIGCMetadata | null> {
    const result = await PDFParser.parse(this.buffer);

    if (!result.info) return null;

    const json = result.info.getAIGC();
    if (!json) return null;

    return MetadataSerializer.deserialize(json);
  }

  async write(data: AIGCMetadata): Promise<void> {
    const json = MetadataSerializer.serialize(data);
    const result = await PDFParser.parse(this.buffer);

    // 获取或创建 Info Dictionary
    let info: InfoDictionary;
    if (result.info) {
      info = result.info;
      info.setAIGC(json);
    } else {
      info = new InfoDictionary();
      info.setAIGC(json);
    }

    // 确定对象号
    const newObjNum = IncrementWriter.determineNewObjNum(
      result.infoObjNum,
      result.xref.entries,
    );

    // 增量写入
    const updatedData = IncrementWriter.write(
      this.buffer,
      info,
      result.trailer,
      result.xref.entries,
      newObjNum,
    );

    this.resultBuffer = (updatedData.buffer as ArrayBuffer).slice(0, updatedData.byteLength);
  }

  async remove(): Promise<void> {
    const result = await PDFParser.parse(this.buffer);

    if (!result.info || !result.info.hasAIGC()) {
      // 没有 AIGC 元数据，无需删除
      this.resultBuffer = (this.buffer.buffer as ArrayBuffer).slice(0, this.buffer.byteLength);
      return;
    }

    // 删除 AIGC 字段
    result.info.deleteAIGC();

    // 增量写入更新后的 Info Dictionary
    const updatedData = IncrementWriter.write(
      this.buffer,
      result.info,
      result.trailer,
      result.xref.entries,
      result.infoObjNum!,
    );

    this.resultBuffer = (updatedData.buffer as ArrayBuffer).slice(0, updatedData.byteLength);
  }

  async has(): Promise<boolean> {
    const result = await PDFParser.parse(this.buffer);
    if (!result.info) return false;
    return result.info.hasAIGC();
  }

  /** 获取更新后的 buffer */
  getResult(): ArrayBuffer {
    return this.resultBuffer ?? (this.buffer.buffer as ArrayBuffer).slice(0, this.buffer.byteLength);
  }
}
