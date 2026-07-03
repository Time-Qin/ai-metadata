import { LOCAL_HEADER_SIZE } from './ZipConstants';

/**
 * Offset 计算工具
 * 纯函数，便于单测
 */
export class OffsetCalculator {
  /**
   * 计算 Local File Header 的数据偏移
   * dataOffset = headerOffset + 30 + fileNameLength + extraFieldLength
   */
  static dataOffset(headerOffset: number, fileNameLength: number, extraFieldLength: number): number {
    return headerOffset + LOCAL_HEADER_SIZE + fileNameLength + extraFieldLength;
  }

  /**
   * 计算下一个 entry 的 header 偏移
   * nextOffset = currentDataOffset + compressedSize
   */
  static nextHeaderOffset(dataOffset: number, compressedSize: number): number {
    return dataOffset + compressedSize;
  }
}
