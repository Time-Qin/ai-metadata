/**
 * PDF 统一解析器
 * 组合 XrefParser + TrailerParser + PDFObjectParser
 * 提供从原始 PDF 字节中提取结构信息的统一接口
 */

import { XrefParser, XrefTable, XrefEntry } from './XrefParser';
import { TrailerParser, TrailerInfo } from './TrailerParser';
import { XrefStreamParser } from './XrefStreamParser';
import { PDFObjectParser } from './PDFObjectParser';
import { InfoDictionary } from './InfoDictionary';
import { findBytesReverse } from '@/utils/BufferUtil';
import { PDFError } from '@/errors/PDFError';

/** %%EOF 标记 */
const EOF_MARKER = new Uint8Array([0x25, 0x25, 0x45, 0x4f, 0x46]); // %%EOF

/** startxref 关键字 */
const STARTXREF_MARKER = new Uint8Array([
  0x73, 0x74, 0x61, 0x72, 0x74, 0x78, 0x72, 0x65, 0x66, // "startxref"
]);

/** PDF 解析结果 */
export interface PDFParseResult {
  /** xref 表 */
  xref: XrefTable;
  /** trailer 信息 */
  trailer: TrailerInfo;
  /** Info Dictionary（如果存在） */
  info: InfoDictionary | null;
  /** Info 对象的对象号（如果存在） */
  infoObjNum: number | null;
  /** 原始 PDF 数据 */
  data: Uint8Array;
}

/**
 * PDF 统一解析器
 */
export class PDFParser {
  /**
   * 解析 PDF 字节流
   * @param data PDF 字节
   * @returns 解析结果
   */
  static async parse(data: Uint8Array): Promise<PDFParseResult> {
    // 1. 验证 PDF 头
    this.validateHeader(data);

    // 2. 查找最后的 %%EOF
    const eofOffset = findBytesReverse(data, EOF_MARKER);
    if (eofOffset < 0) {
      throw new PDFError('PDF_004', '%%EOF marker not found');
    }

    // 3. 查找 startxref
    const startxrefOffset = findBytesReverse(data, STARTXREF_MARKER, eofOffset);
    if (startxrefOffset < 0) {
      throw new PDFError('PDF_004', 'startxref not found');
    }

    // 4. 读取 xref 偏移
    const xrefOffset = this.readStartxrefValue(data, startxrefOffset);

    // 5. 检测格式并解析 xref + trailer
    let xref: XrefTable;
    let trailer: TrailerInfo;

    if (XrefStreamParser.isXrefStream(data, xrefOffset)) {
      // XRef Stream (PDF 1.5+)
      const result = await XrefStreamParser.parse(data, xrefOffset);
      xref = result.xref;
      trailer = result.trailer;
    } else {
      // 传统 xref 表
      xref = XrefParser.parse(data, xrefOffset);
      trailer = TrailerParser.parse(data, xrefOffset, xrefOffset);
    }

    // 6. 检查加密
    if (trailer.encrypt) {
      throw new PDFError('PDF_005', 'Encrypted PDF is not supported');
    }

    // 7. 查找并解析 Info Dictionary
    let info: InfoDictionary | null = null;
    let infoObjNum: number | null = null;

    if (trailer.info) {
      infoObjNum = trailer.info.objNum;
      const entry = xref.entries.get(infoObjNum);
      if (entry && !entry.compressed) {
        // 跳过 Type 2（压缩对象）的 Info Dictionary
        info = InfoDictionary.fromObject(data, entry.offset);
      }
    }

    return { xref, trailer, info, infoObjNum, data };
  }

  /** 验证 PDF 头 */
  private static validateHeader(data: Uint8Array): void {
    // %PDF- (25 50 44 46 2D)
    if (data.length < 5 ||
        data[0] !== 0x25 || data[1] !== 0x50 || data[2] !== 0x44 || data[3] !== 0x46 || data[4] !== 0x2d) {
      throw new PDFError('PDF_003', 'Invalid PDF header: expected %PDF-');
    }
  }

  /** 读取 startxref 后的偏移值 */
  private static readStartxrefValue(data: Uint8Array, startxrefOffset: number): number {
    let pos = startxrefOffset + STARTXREF_MARKER.length;

    // 跳过空白
    while (pos < data.length) {
      const byte = data[pos]!;
      if (byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d || byte === 0x0c) {
        pos++;
      } else {
        break;
      }
    }

    // 读取数字
    let numStr = '';
    while (pos < data.length) {
      const byte = data[pos]!;
      if (byte >= 0x30 && byte <= 0x39) {
        numStr += String.fromCharCode(byte);
        pos++;
      } else {
        break;
      }
    }

    const offset = parseInt(numStr, 10);
    if (isNaN(offset)) {
      throw new PDFError('PDF_004', `Invalid startxref value: "${numStr}"`);
    }

    return offset;
  }

  /**
   * 从解析结果中获取 xref 条目
   */
  static getXrefEntry(result: PDFParseResult, objNum: number): XrefEntry | null {
    return result.xref.entries.get(objNum) ?? null;
  }

  /**
   * 解析指定偏移的间接对象
   */
  static parseObjectAt(data: Uint8Array, offset: number) {
    const parser = new PDFObjectParser(data);
    return parser.parseIndirectObject(offset);
  }
}
