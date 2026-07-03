/**
 * PDF Xref (Cross-Reference) 表解析器
 *
 * xref 表格式:
 * xref
 * 0 N
 * OOOOOOOOOO GGGGG n
 * OOOOOOOOOO GGGGG f
 * ...
 */

import { PDFTokenizer } from './PDFTokenizer';
import { PDFError } from '@/errors/PDFError';

/** 单个 xref 条目 */
export interface XrefEntry {
  offset: number;
  generation: number;
  inUse: boolean; // n=使用中, f=已释放
  /** Type 2 (压缩对象): 是否为压缩条目 */
  compressed?: boolean;
  /** Type 2: 对象流的对象号 */
  objStreamNum?: number;
  /** Type 2: 在对象流中的索引 */
  indexInStream?: number;
}

/** xref 表 */
export interface XrefTable {
  /** 对象号 → 条目 */
  entries: Map<number, XrefEntry>;
  /** xref 表的起始对象号 */
  startObjNum: number;
  /** xref 表的条目数 */
  count: number;
  /** xref 关键字在文件中的偏移 */
  xrefOffset: number;
}

/**
 * Xref 表解析器
 */
export class XrefParser {
  /**
   * 从指定偏移解析 xref 表
   * @param data PDF 字节流
   * @param offset xref 关键字的偏移
   * @returns 解析后的 xref 表
   */
  static parse(data: Uint8Array, offset: number): XrefTable {
    const tokenizer = new PDFTokenizer(data, offset);
    tokenizer.skipWhitespace();

    // 读取 "xref" 关键字
    const line = tokenizer.readLine().trim();
    if (line !== 'xref') {
      throw new PDFError('PDF_006', `Expected "xref" keyword at offset ${offset} but got "${line}". This may be an XRef Stream (PDF 1.5+).`);
    }

    const entries = new Map<number, XrefEntry>();
    let startObjNum = 0;
    let count = 0;

    // 逐段读取 subsection
    while (true) {
      tokenizer.skipWhitespace();
      const savedPos = tokenizer.position;
      const sectionLine = tokenizer.readLine().trim();

      if (sectionLine === 'trailer' || sectionLine === '') {
        // 到达 trailer 或空行，结束
        tokenizer.seek(savedPos);
        break;
      }

      // 解析 subsection header: "start count"
      const parts = sectionLine.split(/\s+/);
      if (parts.length !== 2) {
        // 可能是 trailer
        tokenizer.seek(savedPos);
        break;
      }

      startObjNum = parseInt(parts[0]!, 10);
      count = parseInt(parts[1]!, 10);
      if (isNaN(startObjNum) || isNaN(count)) {
        tokenizer.seek(savedPos);
        break;
      }

      // 读取 count 个条目，每条 20 字节
      for (let i = 0; i < count; i++) {
        tokenizer.skipWhitespace();
        const entryLine = tokenizer.readLine().trim();
        const entryParts = entryLine.split(/\s+/);
        if (entryParts.length < 3) {
          throw new PDFError('PDF_001', `Invalid xref entry at object ${startObjNum + i}: "${entryLine}"`);
        }

        const objOffset = parseInt(entryParts[0]!, 10);
        const generation = parseInt(entryParts[1]!, 10);
        const status = entryParts[2]!;

        const objNum = startObjNum + i;
        entries.set(objNum, {
          offset: objOffset,
          generation,
          inUse: status === 'n',
        });
      }
    }

    return { entries, startObjNum, count, xrefOffset: offset };
  }
}
