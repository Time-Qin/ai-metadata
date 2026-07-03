import { EOCD_SIGNATURE, EOCD_SIZE, MAX_ZIP_COMMENT } from './ZipConstants';
import type { EOCDRecord } from './ZipEntry';
import { ZipError } from '@/errors/ZipError';

/**
 * EOCD（End of Central Directory）解析器
 * 从 ZIP 文件末尾向前扫描查找 EOCD 签名
 */
export class EOCDParser {
  /**
   * 从 buffer 末尾向前扫描，找到 EOCD
   * @throws ZipError 如果找不到 EOCD
   */
  parse(buffer: Uint8Array): EOCDRecord {
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    // 从末尾向前扫描，最多扫描 22 + 65535 字节
    const minOffset = Math.max(0, buffer.length - EOCD_SIZE - MAX_ZIP_COMMENT);
    const maxOffset = buffer.length - EOCD_SIZE;

    for (let i = maxOffset; i >= minOffset; i--) {
      // 检查 EOCD 签名 (Little Endian)
      if (view.getUint32(i, true) === EOCD_SIGNATURE) {
        // 验证 comment length 合理
        const commentLength = view.getUint16(i + 20, true);
        if (i + EOCD_SIZE + commentLength === buffer.length) {
          return this.parseRecord(view, i);
        }
      }
    }

    throw new ZipError('ZIP_001', 'EOCD not found');
  }

  private parseRecord(view: DataView, offset: number): EOCDRecord {
    const totalEntries = view.getUint16(offset + 10, true);
    const cdSize = view.getUint32(offset + 12, true);
    const cdOffset = view.getUint32(offset + 16, true);

    return {
      offset,
      totalEntries,
      cdSize,
      cdOffset,
    };
  }
}
