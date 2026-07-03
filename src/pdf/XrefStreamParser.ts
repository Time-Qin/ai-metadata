/**
 * PDF 交叉引用流 (XRef Stream) 解析器
 *
 * PDF 1.5+ 支持使用流对象代替传统 xref 表。
 * 流对象的字典包含 trailer 信息 (/Size, /Root, /Info 等)，
 * 流内容包含二进制编码的交叉引用条目。
 *
 * 格式:
 * N M obj
 * << /Type /XRef /Size N /Root X 0 R /W [w1 w2 w1] /Length L [/Filter /FlateDecode] >>
 * stream
 * ...二进制数据...
 * endstream
 * endobj
 */

import { PDFObjectParser } from './PDFObjectParser';
import { PDFTokenizer, TokenType } from './PDFTokenizer';
import { XrefParser, XrefTable, XrefEntry } from './XrefParser';
import { TrailerParser, TrailerInfo } from './TrailerParser';
import { PDFDictionary } from './PDFObject';
import { CompressionFactory } from '@/compression/CompressionFactory';
import { PDFError } from '@/errors/PDFError';

/** XRef Stream 解析结果 */
export interface XrefStreamParseResult {
  xref: XrefTable;
  trailer: TrailerInfo;
}

/**
 * XRef Stream 解析器
 */
export class XrefStreamParser {
  /**
   * 检测指定偏移处是否为 XRef Stream（而非传统 xref 表）
   * 如果第一个 token 是数字（间接对象号），则为 XRef Stream
   * 如果第一个 token 是 "xref" 关键字，则为传统 xref 表
   */
  static isXrefStream(data: Uint8Array, offset: number): boolean {
    const tokenizer = new PDFTokenizer(data, offset);
    tokenizer.skipWhitespace();
    const token = tokenizer.nextToken();
    return token.type === TokenType.Number;
  }

  /**
   * 解析 XRef Stream
   * 解析主流对象，然后沿 /Prev 链合并所有 xref 条目
   * /Prev 可能指向另一个 XRef Stream 或传统 xref 表
   * @param data PDF 字节流
   * @param offset XRef Stream 对象的偏移
   * @returns 合并后的 xref 表和 trailer 信息
   */
  static async parse(data: Uint8Array, offset: number): Promise<XrefStreamParseResult> {
    const visited = new Set<number>();
    const mergedEntries = new Map<number, XrefEntry>();
    let latestTrailer: TrailerInfo | null = null;
    let currentOffset = offset;

    while (currentOffset >= 0 && !visited.has(currentOffset)) {
      visited.add(currentOffset);

      if (this.isXrefStream(data, currentOffset)) {
        // XRef Stream 路径
        const { xref, trailer } = await this.parseSingle(data, currentOffset);

        if (!latestTrailer) {
          latestTrailer = trailer;
        }

        for (const [objNum, entry] of xref.entries) {
          if (!mergedEntries.has(objNum)) {
            mergedEntries.set(objNum, entry);
          }
        }

        if (trailer.prev !== null && trailer.prev >= 0) {
          currentOffset = trailer.prev;
        } else {
          break;
        }
      } else {
        // 传统 xref 表路径（/Prev 指向传统 xref）
        const xref = XrefParser.parse(data, currentOffset);
        const trailer = TrailerParser.parse(data, currentOffset, currentOffset);

        if (!latestTrailer) {
          latestTrailer = trailer;
        }

        for (const [objNum, entry] of xref.entries) {
          if (!mergedEntries.has(objNum)) {
            mergedEntries.set(objNum, entry);
          }
        }

        if (trailer.prev !== null && trailer.prev >= 0) {
          currentOffset = trailer.prev;
        } else {
          break;
        }
      }
    }

    if (!latestTrailer) {
      throw new PDFError('PDF_006', 'Failed to parse XRef Stream');
    }

    const xrefTable: XrefTable = {
      entries: mergedEntries,
      startObjNum: 0,
      count: mergedEntries.size,
      xrefOffset: offset,
    };

    return { xref: xrefTable, trailer: latestTrailer };
  }

  /**
   * 解析单个 XRef Stream 对象
   */
  private static async parseSingle(data: Uint8Array, offset: number): Promise<XrefStreamParseResult> {
    const parser = new PDFObjectParser(data);
    const { dictionary, streamData } = parser.parseStreamObject(offset);

    // 验证 /Type /XRef
    const typeVal = dictionary.entries.get('Type');
    if (!typeVal || typeVal.type !== 'name' || typeVal.value !== 'XRef') {
      throw new PDFError('PDF_006', `Stream at offset ${offset} is not /Type /XRef`);
    }

    // 处理压缩
    const filterVal = dictionary.entries.get('Filter');
    let decodedData = streamData;
    if (filterVal) {
      if (filterVal.type === 'name' && filterVal.value === 'FlateDecode') {
        const compression = CompressionFactory.create();
        decodedData = await compression.decompress(streamData);
      } else if (filterVal.type === 'array' && filterVal.items.length === 1) {
        const item = filterVal.items[0]!;
        if (item.type === 'name' && item.value === 'FlateDecode') {
          const compression = CompressionFactory.create();
          decodedData = await compression.decompress(streamData);
        } else {
          throw new PDFError('PDF_006', `Unsupported stream filter: ${item.type === 'name' ? item.value : 'unknown'}`);
        }
      } else {
        const filterName = filterVal.type === 'name' ? filterVal.value : 'multi-filter';
        throw new PDFError('PDF_006', `Unsupported stream filter: ${filterName}`);
      }
    }

    // 解码二进制 xref 条目
    const xref = this.decodeEntries(decodedData, dictionary, offset);

    // 从流字典提取 trailer 信息
    const trailer = TrailerParser.extractTrailerInfo(dictionary);
    trailer.xrefOffset = offset;

    return { xref, trailer };
  }

  /**
   * 解码二进制 xref 条目
   * /W [w1 w2 w3] 指定三个字段的字节宽度: [type, field2, field3]
   * /Index [start count ...] 可选，指定条目对应的对象号
   */
  private static decodeEntries(streamData: Uint8Array, dict: PDFDictionary, xrefOffset: number): XrefTable {
    // 读取 /W 数组
    const wVal = dict.entries.get('W');
    if (!wVal || wVal.type !== 'array' || wVal.items.length < 3) {
      throw new PDFError('PDF_006', 'XRef stream missing or invalid /W array');
    }

    const w1 = wVal.items[0]!.type === 'number' ? wVal.items[0]!.value : 0;
    const w2 = wVal.items[1]!.type === 'number' ? wVal.items[1]!.value : 0;
    const w3 = wVal.items[2]!.type === 'number' ? wVal.items[2]!.value : 0;

    // 读取 /Size
    const sizeVal = dict.entries.get('Size');
    if (!sizeVal || sizeVal.type !== 'number') {
      throw new PDFError('PDF_006', 'XRef stream missing /Size');
    }
    const size = sizeVal.value;

    // 读取 /Index 数组（可选），默认: [0, size]
    const indexVal = dict.entries.get('Index');
    const indexPairs: Array<{ start: number; count: number }> = [];
    if (indexVal && indexVal.type === 'array') {
      for (let i = 0; i < indexVal.items.length; i += 2) {
        const start = indexVal.items[i];
        const count = indexVal.items[i + 1];
        if (start && count && start.type === 'number' && count.type === 'number') {
          indexPairs.push({ start: start.value, count: count.value });
        }
      }
    } else {
      indexPairs.push({ start: 0, count: size });
    }

    const entrySize = w1 + w2 + w3;
    const entries = new Map<number, XrefEntry>();

    // 默认前值（用于宽度为 0 的字段）
    let prevType = 1;
    let prevField2 = 0;
    let prevField3 = 0;

    let dataOffset = 0;

    for (const { start, count } of indexPairs) {
      for (let i = 0; i < count; i++) {
        if (dataOffset + entrySize > streamData.length) {
          break;
        }

        let type = prevType;
        let field2 = prevField2;
        let field3 = prevField3;

        let fieldOffset = dataOffset;

        if (w1 > 0) {
          type = this.readUIntBE(streamData, fieldOffset, w1);
          fieldOffset += w1;
          prevType = type;
        }

        if (w2 > 0) {
          field2 = this.readUIntBE(streamData, fieldOffset, w2);
          fieldOffset += w2;
          prevField2 = field2;
        }

        if (w3 > 0) {
          field3 = this.readUIntBE(streamData, fieldOffset, w3);
          fieldOffset += w3;
          prevField3 = field3;
        }

        dataOffset += entrySize;

        const objNum = start + i;

        if (type === 0) {
          // 空闲对象
          entries.set(objNum, {
            offset: 0,
            generation: field3,
            inUse: false,
          });
        } else if (type === 1) {
          // 未压缩对象
          entries.set(objNum, {
            offset: field2,
            generation: field3,
            inUse: true,
          });
        } else if (type === 2) {
          // 压缩对象
          entries.set(objNum, {
            offset: 0,
            generation: 0,
            inUse: true,
            compressed: true,
            objStreamNum: field2,
            indexInStream: field3,
          });
        }
      }
    }

    return {
      entries,
      startObjNum: 0,
      count: entries.size,
      xrefOffset,
    };
  }

  /**
   * 读取大端无符号整数
   * 使用乘法而非位移，支持宽度 > 4 的字段
   */
  private static readUIntBE(data: Uint8Array, offset: number, width: number): number {
    let value = 0;
    for (let i = 0; i < width; i++) {
      value = value * 256 + (data[offset + i] ?? 0);
    }
    return value;
  }
}
