/**
 * ZIP Entry 数据结构
 */
export interface ZipEntry {
  /** 文件名 */
  fileName: string;
  /** 文件名字节 */
  fileNameBytes: Uint8Array;
  /** 压缩方法 (0=STORED, 8=DEFLATE) */
  compressionMethod: number;
  /** 压缩后大小 */
  compressedSize: number;
  /** 未压缩大小 */
  uncompressedSize: number;
  /** CRC32 校验值 */
  crc32: number;
  /** 通用标志位 */
  flags: number;
  /** 版本 */
  version: number;
  /** 最后修改时间 */
  modTime: number;
  /** 最后修改日期 */
  modDate: number;
  /** 外部属性 */
  externalAttr: number;
  /** Local File Header 的偏移 */
  headerOffset: number;
  /** 数据偏移（headerOffset + 30 + fileNameLen + extraFieldLen） */
  dataOffset: number;
  /** 额外字段（来自 CD） */
  extraField: Uint8Array;
  /** 压缩数据（lazy，按需读取） */
  compressedData?: Uint8Array;
  /** 标记是否被修改 */
  dirty: boolean;
  /** 新的未压缩数据（dirty 时使用） */
  newData?: Uint8Array;
}

/**
 * EOCD 记录
 */
export interface EOCDRecord {
  /** EOCD 在文件中的偏移 */
  offset: number;
  /** 总 entry 数 */
  totalEntries: number;
  /** Central Directory 大小 */
  cdSize: number;
  /** Central Directory 偏移 */
  cdOffset: number;
}
