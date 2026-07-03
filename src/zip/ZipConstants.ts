/**
 * ZIP 文件格式常量
 */

/** Local File Header 签名 */
export const LOCAL_HEADER_SIGNATURE = 0x04034b50;

/** Central Directory 签名 */
export const CD_SIGNATURE = 0x02014b50;

/** End of Central Directory 签名 */
export const EOCD_SIGNATURE = 0x06054b50;

/** Data Descriptor 签名 */
export const DATA_DESCRIPTOR_SIGNATURE = 0x08074b50;

/** Local File Header 固定长度 */
export const LOCAL_HEADER_SIZE = 30;

/** Central Directory Header 固定长度 */
export const CD_HEADER_SIZE = 46;

/** EOCD 固定长度 */
export const EOCD_SIZE = 22;

/** 最大 EOCD 注释长度 */
export const MAX_ZIP_COMMENT = 0xffff;

/** 压缩方法：STORED（无压缩） */
export const COMPRESSION_STORED = 0;

/** 压缩方法：DEFLATE */
export const COMPRESSION_DEFLATE = 8;

/** 通用标志位：bit 3 - Data Descriptor */
export const FLAG_DATA_DESCRIPTOR = 0x0008;

/** 通用标志位：bit 11 - UTF-8 文件名 */
export const FLAG_UTF8 = 0x0800;
