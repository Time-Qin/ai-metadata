/**
 * AIGC SDK
 * 对外唯一入口，统一处理 OOXML 和 PDF 文件的 AIGC 元数据
 *
 * 使用方式:
 *   const sdk = new AIGCSDK();
 *   const newBuffer = await sdk.addMetadata(buffer, metadata);
 *   const metadata = await sdk.readMetadata(buffer);
 */

import type { AIGCMetadata } from '@/metadata/Metadata';
import type { MetadataEditor } from '@/metadata/MetadataEditor';
import type { SDKOptions } from './SDKOptions';
import { DEFAULT_OPTIONS } from './SDKOptions';
import { FileDetector } from '@/detector/FileDetector';
import { FileType } from '@/detector/FileType';
import { OOXMLMetadataEditor } from '@/ooxml/OOXMLMetadataEditor';
import { PDFMetadataEditor } from '@/pdf/PDFMetadataEditor';
import { MetadataValidator } from '@/metadata/MetadataValidator';
import { UnsupportedFileError } from '@/errors/UnsupportedFileError';
import { MetadataError } from '@/errors/MetadataError';

export class AIGCSDK {
  private readonly options: SDKOptions;

  constructor(options?: SDKOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * 写入 AIGC 元数据到文件
   * @param buffer 文件内容
   * @param metadata AIGC 元数据
   * @returns 更新后的文件内容
   */
  async addMetadata(buffer: ArrayBuffer, metadata: AIGCMetadata): Promise<ArrayBuffer> {
    if (this.options.strictMode) {
      MetadataValidator.assertValid(metadata);
    } else if (!MetadataValidator.validate(metadata)) {
      throw new MetadataError('META_001', 'Invalid metadata: all 7 fields must be present and string type');
    }

    const editor = this.createEditor(buffer);
    await editor.write(metadata);
    return editor.getResult();
  }

  /**
   * 读取 AIGC 元数据
   * @param buffer 文件内容
   * @returns 元数据，不存在返回 null
   */
  async readMetadata(buffer: ArrayBuffer): Promise<AIGCMetadata | null> {
    const editor = this.createEditor(buffer);
    return editor.read();
  }

  /**
   * 删除 AIGC 元数据
   * @param buffer 文件内容
   * @returns 更新后的文件内容
   */
  async removeMetadata(buffer: ArrayBuffer): Promise<ArrayBuffer> {
    const editor = this.createEditor(buffer);
    await editor.remove();
    return editor.getResult();
  }

  /**
   * 判断是否存在 AIGC 元数据
   * @param buffer 文件内容
   * @returns 是否存在
   */
  async hasMetadata(buffer: ArrayBuffer): Promise<boolean> {
    const editor = this.createEditor(buffer);
    return editor.has();
  }

  /**
   * 校验元数据是否合法
   * @param metadata 元数据
   * @returns 是否合法
   */
  validateMetadata(metadata: AIGCMetadata): boolean {
    return MetadataValidator.validate(metadata);
  }

  /**
   * 根据文件类型创建对应的编辑器
   */
  private createEditor(buffer: ArrayBuffer): MetadataEditor {
    const fileType = FileDetector.detect(buffer);

    switch (fileType) {
      case FileType.DOCX:
      case FileType.PPTX:
      case FileType.XLSX:
        return new OOXMLMetadataEditor(buffer);

      case FileType.PDF:
        return new PDFMetadataEditor(buffer);

      default:
        throw new UnsupportedFileError(
          'FILE_002',
          `Unsupported file type: ${fileType}. Only DOCX, PPTX, XLSX, and PDF are supported.`,
        );
    }
  }
}
