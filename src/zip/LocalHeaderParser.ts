import { LOCAL_HEADER_SIGNATURE } from './ZipConstants';
import { ZipError } from '@/errors/ZipError';

/**
 * Local File Header 信息
 */
export interface LocalFileHeader {
  signature: number;
  version: number;
  flags: number;
  compressionMethod: number;
  modTime: number;
  modDate: number;
  crc32: number;
  compressedSize: number;
  uncompressedSize: number;
  fileNameLength: number;
  extraFieldLength: number;
}

/**
 * Local File Header 解析器
 */
export class LocalHeaderParser {
  /**
   * 解析指定偏移处的 Local File Header
   */
  parse(buffer: Uint8Array, offset: number): LocalFileHeader {
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    if (offset + 30 > buffer.length) {
      throw new ZipError('ZIP_003', `Local header at offset ${offset} exceeds buffer`);
    }

    const signature = view.getUint32(offset, true);
    if (signature !== LOCAL_HEADER_SIGNATURE) {
      throw new ZipError('ZIP_003', `Invalid local header signature at offset ${offset}`);
    }

    return {
      signature,
      version: view.getUint16(offset + 4, true),
      flags: view.getUint16(offset + 6, true),
      compressionMethod: view.getUint16(offset + 8, true),
      modTime: view.getUint16(offset + 10, true),
      modDate: view.getUint16(offset + 12, true),
      crc32: view.getUint32(offset + 14, true),
      compressedSize: view.getUint32(offset + 18, true),
      uncompressedSize: view.getUint32(offset + 22, true),
      fileNameLength: view.getUint16(offset + 26, true),
      extraFieldLength: view.getUint16(offset + 28, true),
    };
  }
}
