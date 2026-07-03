import { EOCDParser } from './EOCDParser';
import { CentralDirectoryParser } from './CentralDirectoryParser';
import type { ZipEntry } from './ZipEntry';
import type { ZipArchive } from './ZipArchive';
import { ZipArchive as ZipArchiveClass } from './ZipArchive';
import { COMPRESSION_STORED, FLAG_DATA_DESCRIPTOR } from './ZipConstants';
import { CompressionFactory } from '@/compression/CompressionFactory';

/**
 * MiniZip Reader
 * 解析 ZIP 文件结构，按需读取 entry 数据
 */
export class MiniZipReader {
  private buffer: Uint8Array;

  constructor(buffer: Uint8Array | ArrayBuffer) {
    this.buffer = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  }

  /**
   * 解析 ZIP 结构，返回 ZipArchive
   */
  read(): ZipArchive {
    const eocdParser = new EOCDParser();
    const eocd = eocdParser.parse(this.buffer);

    const cdParser = new CentralDirectoryParser();
    const entries = cdParser.parse(this.buffer, eocd.cdOffset, eocd.totalEntries);

    return new ZipArchiveClass(entries, eocd);
  }

  /**
   * 读取 entry 的压缩数据（不解压）
   */
  readCompressedData(entry: ZipEntry): Uint8Array {
    return this.buffer.subarray(entry.dataOffset, entry.dataOffset + entry.compressedSize);
  }

  /**
   * 读取并解压 entry 数据
   */
  async readEntryData(entry: ZipEntry): Promise<Uint8Array> {
    const compressedData = this.readCompressedData(entry);

    if (entry.compressionMethod === COMPRESSION_STORED) {
      // STORED：无压缩，直接返回
      return new Uint8Array(compressedData);
    }

    // DEFLATE：解压
    const decompressor = CompressionFactory.create();
    return decompressor.decompress(compressedData);
  }

  /**
   * 判断 entry 是否使用了 Data Descriptor（flag bit 3）
   */
  hasDataDescriptor(entry: ZipEntry): boolean {
    return (entry.flags & FLAG_DATA_DESCRIPTOR) !== 0;
  }
}
