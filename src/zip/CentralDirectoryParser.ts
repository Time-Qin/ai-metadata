import { CD_SIGNATURE, CD_HEADER_SIZE } from './ZipConstants';
import type { ZipEntry } from './ZipEntry';
import { OffsetCalculator } from './OffsetCalculator';
import { ZipError } from '@/errors/ZipError';

/**
 * Central Directory 解析器
 * 从 cdOffset 起逐条解析 46 字节 CD 头
 */
export class CentralDirectoryParser {
  /**
   * 解析所有 Central Directory entries
   */
  parse(buffer: Uint8Array, cdOffset: number, totalEntries: number): ZipEntry[] {
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const entries: ZipEntry[] = [];
    let offset = cdOffset;

    for (let i = 0; i < totalEntries; i++) {
      // 检查 CD 签名
      if (offset + CD_HEADER_SIZE > buffer.length) {
        throw new ZipError('ZIP_002', `Central directory entry ${i} exceeds buffer`);
      }
      if (view.getUint32(offset, true) !== CD_SIGNATURE) {
        throw new ZipError('ZIP_002', `Invalid CD signature at offset ${offset}`);
      }

      const entry = this.parseEntry(view, buffer, offset);
      entries.push(entry);

      // 前进到下一个 CD entry
      const fileNameLen = view.getUint16(offset + 28, true);
      const extraLen = view.getUint16(offset + 30, true);
      const commentLen = view.getUint16(offset + 32, true);
      offset += CD_HEADER_SIZE + fileNameLen + extraLen + commentLen;
    }

    return entries;
  }

  private parseEntry(view: DataView, buffer: Uint8Array, offset: number): ZipEntry {
    const version = view.getUint16(offset + 4, true);
    const flags = view.getUint16(offset + 8, true);
    const compressionMethod = view.getUint16(offset + 10, true);
    const modTime = view.getUint16(offset + 12, true);
    const modDate = view.getUint16(offset + 14, true);
    const crc32 = view.getUint32(offset + 16, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const fileNameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const externalAttr = view.getUint32(offset + 38, true);
    const headerOffset = view.getUint32(offset + 42, true);

    // 读取文件名
    const fileNameStart = offset + CD_HEADER_SIZE;
    const fileNameBytes = buffer.subarray(fileNameStart, fileNameStart + fileNameLen);
    const fileName = new TextDecoder('utf-8').decode(fileNameBytes);

    // 读取 extra field
    const extraStart = fileNameStart + fileNameLen;
    const extraField = buffer.subarray(extraStart, extraStart + extraLen);

    // 计算 dataOffset（需要读 Local File Header 的 extra field 长度）
    // 注意：LFH 的 extra field 长度可能与 CD 的不同
    const dataOffset = this.resolveDataOffset(buffer, headerOffset, view);

    return {
      fileName,
      fileNameBytes: new Uint8Array(fileNameBytes),
      compressionMethod,
      compressedSize,
      uncompressedSize,
      crc32,
      flags,
      version,
      modTime,
      modDate,
      externalAttr,
      headerOffset,
      dataOffset,
      extraField: new Uint8Array(extraField),
      dirty: false,
    };
  }

  /**
   * 读取 Local File Header 获取其 extra field 长度，计算 dataOffset
   */
  private resolveDataOffset(buffer: Uint8Array, headerOffset: number, view: DataView): number {
    if (headerOffset + 30 > buffer.length) {
      throw new ZipError('ZIP_003', `Local header offset ${headerOffset} exceeds buffer`);
    }

    const lfhExtraLen = view.getUint16(headerOffset + 28, true);
    const lfhFileNameLen = view.getUint16(headerOffset + 26, true);

    return OffsetCalculator.dataOffset(headerOffset, lfhFileNameLen, lfhExtraLen);
  }
}
