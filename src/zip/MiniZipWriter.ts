import type { ZipEntry } from './ZipEntry';
import type { ZipArchive } from './ZipArchive';
import { BinaryWriter } from '@/core/BinaryWriter';
import { CRC32 } from '@/core/CRC32';
import { CompressionFactory } from '@/compression/CompressionFactory';
import {
  LOCAL_HEADER_SIGNATURE,
  CD_SIGNATURE,
  EOCD_SIGNATURE,
  COMPRESSION_DEFLATE,
  COMPRESSION_STORED,
  FLAG_UTF8,
} from './ZipConstants';

/**
 * MiniZip Writer
 * 在不破坏 ZIP 结构的前提下重建 ZIP 文件
 *
 * 核心策略：
 * - 完全重建 ZIP 二进制，保留 entries 顺序
 * - 未变更 entry 直接拷贝原始压缩字节
 * - 变更 entry 重新 deflate + 重算 CRC（对未压缩数据）
 * - 重建时 extra field 清零，flag bit 3（data descriptor）清零
 */
export class MiniZipWriter {
  private originalBuffer: Uint8Array;
  private entries: ZipEntry[];

  constructor(archive: ZipArchive, originalBuffer?: Uint8Array) {
    this.entries = [...archive.entries];
    this.originalBuffer = originalBuffer ?? new Uint8Array(0);
  }

  /**
   * 更新 entry 的数据
   */
  updateEntry(fileName: string, data: Uint8Array): void {
    const index = this.entries.findIndex((e) => e.fileName === fileName);
    if (index === -1) {
      throw new Error(`Entry not found: ${fileName}`);
    }
    const entry = this.entries[index]!;
    entry.dirty = true;
    entry.newData = data;
  }

  /**
   * 添加新 entry
   */
  addEntry(fileName: string, data: Uint8Array): void {
    const fileNameBytes = new TextEncoder().encode(fileName);
    const newEntry: ZipEntry = {
      fileName,
      fileNameBytes,
      compressionMethod: COMPRESSION_DEFLATE,
      compressedSize: 0,
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
    this.entries.push(newEntry);
  }

  /**
   * 移除 entry
   */
  removeEntry(fileName: string): boolean {
    const index = this.entries.findIndex((e) => e.fileName === fileName);
    if (index === -1) return false;
    this.entries.splice(index, 1);
    return true;
  }

  /**
   * 重建 ZIP，返回新 ArrayBuffer
   */
  async build(): Promise<ArrayBuffer> {
    // 第一阶段：准备所有 entry 的压缩数据和元数据
    const preparedEntries: Array<{
      fileName: string;
      fileNameBytes: Uint8Array;
      compressedData: Uint8Array;
      crc32: number;
      compressedSize: number;
      uncompressedSize: number;
      compressionMethod: number;
      flags: number;
      version: number;
      modTime: number;
      modDate: number;
      externalAttr: number;
    }> = [];

    for (const entry of this.entries) {
      if (entry.dirty && entry.newData) {
        // 变更的 entry：重新压缩 + 重算 CRC
        const uncompressedData = entry.newData;
        const crc = CRC32.compute(uncompressedData);

        let compressedData: Uint8Array;
        let compressionMethod: number;

        if (entry.compressionMethod === COMPRESSION_STORED) {
          compressedData = uncompressedData;
          compressionMethod = COMPRESSION_STORED;
        } else {
          const compressor = CompressionFactory.create();
          compressedData = await compressor.compress(uncompressedData);
          compressionMethod = COMPRESSION_DEFLATE;
        }

        preparedEntries.push({
          fileName: entry.fileName,
          fileNameBytes: entry.fileNameBytes,
          compressedData,
          crc32: crc,
          compressedSize: compressedData.length,
          uncompressedSize: uncompressedData.length,
          compressionMethod,
          flags: entry.flags & ~0x0008, // 清除 data descriptor flag
          version: entry.version,
          modTime: entry.modTime,
          modDate: entry.modDate,
          externalAttr: entry.externalAttr,
        });
      } else {
        // 未变更 entry：拷贝原始压缩字节
        const compressedData = this.originalBuffer.subarray(
          entry.dataOffset,
          entry.dataOffset + entry.compressedSize,
        );
        preparedEntries.push({
          fileName: entry.fileName,
          fileNameBytes: entry.fileNameBytes,
          compressedData: new Uint8Array(compressedData),
          crc32: entry.crc32,
          compressedSize: entry.compressedSize,
          uncompressedSize: entry.uncompressedSize,
          compressionMethod: entry.compressionMethod,
          flags: entry.flags & ~0x0008, // 清除 data descriptor flag
          version: entry.version,
          modTime: entry.modTime,
          modDate: entry.modDate,
          externalAttr: entry.externalAttr,
        });
      }
    }

    // 第二阶段：写 Local File Headers + 数据，记录 headerOffset
    const lfWriter = new BinaryWriter();
    const headerOffsets: number[] = [];

    for (const pe of preparedEntries) {
      headerOffsets.push(lfWriter.size);

      // Local File Header (30 bytes)
      lfWriter.writeUint32(LOCAL_HEADER_SIGNATURE, true);
      lfWriter.writeUint16(pe.version, true);
      lfWriter.writeUint16(pe.flags, true);
      lfWriter.writeUint16(pe.compressionMethod, true);
      lfWriter.writeUint16(pe.modTime, true);
      lfWriter.writeUint16(pe.modDate, true);
      lfWriter.writeUint32(pe.crc32, true);
      lfWriter.writeUint32(pe.compressedSize, true);
      lfWriter.writeUint32(pe.uncompressedSize, true);
      lfWriter.writeUint16(pe.fileNameBytes.length, true);
      lfWriter.writeUint16(0, true); // extra field length = 0
      lfWriter.writeBytes(pe.fileNameBytes);
      lfWriter.writeBytes(pe.compressedData);
    }

    const cdOffset = lfWriter.size;

    // 第三阶段：写 Central Directory
    for (let i = 0; i < preparedEntries.length; i++) {
      const pe = preparedEntries[i]!;

      lfWriter.writeUint32(CD_SIGNATURE, true);
      lfWriter.writeUint16(pe.version, true); // version made by
      lfWriter.writeUint16(pe.version, true); // version needed
      lfWriter.writeUint16(pe.flags, true);
      lfWriter.writeUint16(pe.compressionMethod, true);
      lfWriter.writeUint16(pe.modTime, true);
      lfWriter.writeUint16(pe.modDate, true);
      lfWriter.writeUint32(pe.crc32, true);
      lfWriter.writeUint32(pe.compressedSize, true);
      lfWriter.writeUint32(pe.uncompressedSize, true);
      lfWriter.writeUint16(pe.fileNameBytes.length, true);
      lfWriter.writeUint16(0, true); // extra field length
      lfWriter.writeUint16(0, true); // comment length
      lfWriter.writeUint16(0, true); // disk number start
      lfWriter.writeUint16(0, true); // internal attributes
      lfWriter.writeUint32(pe.externalAttr, true); // external attributes
      lfWriter.writeUint32(headerOffsets[i]!, true); // local header offset
      lfWriter.writeBytes(pe.fileNameBytes);
    }

    const cdSize = lfWriter.size - cdOffset;

    // 第四阶段：写 EOCD
    lfWriter.writeUint32(EOCD_SIGNATURE, true);
    lfWriter.writeUint16(0, true); // disk number
    lfWriter.writeUint16(0, true); // start disk
    lfWriter.writeUint16(preparedEntries.length, true); // entries on this disk
    lfWriter.writeUint16(preparedEntries.length, true); // total entries
    lfWriter.writeUint32(cdSize, true); // CD size
    lfWriter.writeUint32(cdOffset, true); // CD offset
    lfWriter.writeUint16(0, true); // comment length

    return lfWriter.toArrayBuffer();
  }
}
