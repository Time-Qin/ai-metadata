/**
 * PDF Trailer 解析器
 *
 * trailer
 * << /Size N /Root X 0 R /Info Y 0 R /Prev Z >>
 */

import { PDFObjectParser } from './PDFObjectParser';
import { PDFDictionary, PDFValue } from './PDFObject';
import { PDFError } from '@/errors/PDFError';

/** Trailer 信息 */
export interface TrailerInfo {
  /** /Size - 对象总数 */
  size: number;
  /** /Root - 文档目录的间接引用 */
  root: { objNum: number; genNum: number } | null;
  /** /Info - Info Dictionary 的间接引用 */
  info: { objNum: number; genNum: number } | null;
  /** /Prev - 前一个 xref 的偏移 */
  prev: number | null;
  /** /Encrypt - 加密字典引用 */
  encrypt: boolean;
  /** 原始字典 */
  dictionary: PDFDictionary;
  /** xref 表在文件中的偏移 */
  xrefOffset: number;
}

/**
 * Trailer 解析器
 */
export class TrailerParser {
  /**
   * 从指定偏移解析 trailer
   * @param data PDF 字节流
   * @param offset trailer 关键字附近的偏移
   * @returns 解析后的 trailer 信息
   */
  static parse(data: Uint8Array, offset: number, xrefOffset: number): TrailerInfo {
    const parser = new PDFObjectParser(data);

    // 从 offset 开始向后搜索 "trailer" 关键字
    const trailerOffset = this.findTrailerKeyword(data, offset);
    if (trailerOffset < 0) {
      throw new PDFError('PDF_002', `Trailer not found near offset ${offset}`);
    }

    // 跳过 "trailer" 关键字，解析字典
    const dictStart = this.skipTrailerKeyword(data, trailerOffset);
    const value = parser.parseValue(dictStart);

    if (value.type !== 'dict') {
      throw new PDFError('PDF_002', `Expected dictionary after trailer keyword at offset ${trailerOffset}`);
    }

    const info = this.extractTrailerInfo(value);
    info.xrefOffset = xrefOffset;
    return info;
  }

  /** 从字典中提取 trailer 信息 */
  static extractTrailerInfo(dict: PDFDictionary): TrailerInfo {
    const size = this.getNumber(dict, 'Size');
    const root = this.getRef(dict, 'Root');
    const info = this.getRef(dict, 'Info');
    const prev = this.getNumberOptional(dict, 'Prev');
    const encrypt = dict.entries.has('Encrypt');

    return { size, root, info, prev, encrypt, dictionary: dict, xrefOffset: 0 };
  }

  /** 在数据中查找 "trailer" 关键字 */
  private static findTrailerKeyword(data: Uint8Array, startOffset: number): number {
    // 从 startOffset 开始搜索 "trailer"
    const pattern = new Uint8Array([0x74, 0x72, 0x61, 0x69, 0x6c, 0x65, 0x72]); // "trailer"
    for (let i = startOffset; i < data.length - pattern.length; i++) {
      let match = true;
      for (let j = 0; j < pattern.length; j++) {
        if (data[i + j] !== pattern[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        // 确保前后是 PDF 空白或分隔符
        // PDF 空白: 0x00 0x09 0x0a 0x0c 0x0d 0x20
        // PDF 分隔符: ( ) < > [ ] { } / %
        const before = i > 0 ? data[i - 1]! : 0x0a;
        const after = data[i + pattern.length] ?? 0x0a;
        if (this.isPdfSeparator(before) && this.isPdfSeparator(after)) {
          return i;
        }
      }
    }
    return -1;
  }

  /** 判断字节是否为 PDF 空白或分隔符 */
  private static isPdfSeparator(byte: number): boolean {
    // PDF 空白: NUL \t \n \f \r space
    // PDF 分隔符: ( ) < > [ ] { } / %
    return byte === 0x00 || byte === 0x09 || byte === 0x0a ||
           byte === 0x0c || byte === 0x0d || byte === 0x20 ||
           byte === 0x28 || byte === 0x29 || byte === 0x3c ||
           byte === 0x3e || byte === 0x5b || byte === 0x5d ||
           byte === 0x7b || byte === 0x7d || byte === 0x2f ||
           byte === 0x25;
  }

  /** 跳过 "trailer" 关键字和空白，返回字典开始偏移 */
  private static skipTrailerKeyword(data: Uint8Array, offset: number): number {
    let pos = offset + 7; // 跳过 "trailer"
    while (pos < data.length) {
      const byte = data[pos]!;
      if (byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d || byte === 0x0c || byte === 0x00) {
        pos++;
      } else {
        break;
      }
    }
    return pos;
  }

  private static getNumber(dict: PDFDictionary, key: string): number {
    const value = dict.entries.get(key);
    if (!value || value.type !== 'number') {
      throw new PDFError('PDF_002', `Missing or invalid /${key} in trailer`);
    }
    return value.value;
  }

  private static getNumberOptional(dict: PDFDictionary, key: string): number | null {
    const value = dict.entries.get(key);
    if (!value || value.type !== 'number') return null;
    return value.value;
  }

  private static getRef(dict: PDFDictionary, key: string): { objNum: number; genNum: number } | null {
    const value: PDFValue | undefined = dict.entries.get(key);
    if (!value || value.type !== 'ref') return null;
    return { objNum: value.objNum, genNum: value.genNum };
  }
}
