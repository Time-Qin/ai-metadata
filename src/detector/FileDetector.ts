/**
 * 文件检测器
 * 基于 Magic Number 识别文件类型，不依赖扩展名
 *
 * 检测流程:
 * 1. 读取前几字节判断 ZIP 或 PDF
 * 2. 若为 ZIP，解析中央目录判断 OOXML 子类型 (DOCX/PPTX/XLSX)
 * 3. 若为 PDF，直接返回 PDF
 * 4. 其他返回 UNKNOWN
 */

import { FileType } from './FileType';
import { MiniZipReader } from '@/zip/MiniZipReader';
import { OOXML_MARKERS } from '@/core/Constants';
import { UnsupportedFileError } from '@/errors/UnsupportedFileError';

/** ZIP Magic Number: PK\x03\x04 */
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];

/** PDF Magic Number: %PDF- */
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d];

/**
 * 文件检测器
 */
export class FileDetector {
  /**
   * 检测文件类型
   * @param buffer 文件内容
   * @returns 文件类型
   * @throws {UnsupportedFileError} 当文件太小无法检测时
   */
  static detect(buffer: ArrayBuffer | Uint8Array): FileType {
    const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

    if (data.length < 4) {
      throw new UnsupportedFileError('FILE_001', 'File too small to detect type');
    }

    // 1. 检测 PDF
    if (this.matchMagic(data, PDF_MAGIC)) {
      return FileType.PDF;
    }

    // 2. 检测 ZIP
    if (this.matchMagic(data, ZIP_MAGIC)) {
      return this.detectZipType(data);
    }

    return FileType.UNKNOWN;
  }

  /**
   * 从 ZIP 内容判断 OOXML 子类型
   * 通过查找特定标记文件
   */
  private static detectZipType(data: Uint8Array): FileType {
    try {
      const reader = new MiniZipReader(data);
      const archive = reader.read();

      if (archive.has(OOXML_MARKERS.DOCX)) {
        return FileType.DOCX;
      }
      if (archive.has(OOXML_MARKERS.PPTX)) {
        return FileType.PPTX;
      }
      if (archive.has(OOXML_MARKERS.XLSX)) {
        return FileType.XLSX;
      }

      return FileType.UNKNOWN;
    } catch {
      // ZIP 解析失败，无法确定类型
      return FileType.UNKNOWN;
    }
  }

  /**
   * 比较文件头部是否匹配 magic number
   */
  private static matchMagic(data: Uint8Array, magic: number[]): boolean {
    if (data.length < magic.length) return false;
    for (let i = 0; i < magic.length; i++) {
      if (data[i] !== magic[i]) return false;
    }
    return true;
  }
}
