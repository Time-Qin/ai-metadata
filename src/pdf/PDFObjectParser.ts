/**
 * PDF 对象解析器
 * 使用 PDFTokenizer 将 token 流解析为 PDF 对象
 */

import { PDFTokenizer, TokenType, Token } from './PDFTokenizer';
import { PDFValue, PDFDictionary, PDFArray, PDFObjects } from './PDFObject';
import { PDFError } from '@/errors/PDFError';

/**
 * PDF 对象解析器
 * 从指定偏移开始解析 PDF 对象
 */
export class PDFObjectParser {
  private tokenizer: PDFTokenizer;
  private readonly data: Uint8Array;

  constructor(data: Uint8Array) {
    this.data = data;
    this.tokenizer = new PDFTokenizer(data);
  }

  /** 从指定偏移开始解析一个 PDF 值 */
  parseValue(offset: number): PDFValue {
    this.tokenizer.seek(offset);
    return this.parseValueAtCurrent();
  }

  /** 在当前位置解析一个 PDF 值 */
  parseValueAtCurrent(): PDFValue {
    const token = this.tokenizer.nextToken();
    return this.parseValueFromToken(token);
  }

  /** 从 token 解析 PDF 值 */
  private parseValueFromToken(token: Token): PDFValue {
    switch (token.type) {
      case TokenType.Number: {
        // 检查是否是间接引用 (N M R)
        const savedPos = this.tokenizer.position;
        const nextToken = this.tokenizer.nextToken();
        if (nextToken.type === TokenType.Number) {
          const thirdToken = this.tokenizer.nextToken();
          if (thirdToken.type === TokenType.Keyword && thirdToken.value === 'R') {
            return PDFObjects.ref(token.value as number, nextToken.value as number);
          }
        }
        // 不是引用，回退
        this.tokenizer.seek(savedPos);
        return PDFObjects.num(token.value as number);
      }

      case TokenType.Name:
        return PDFObjects.name(token.value as string);

      case TokenType.LiteralString:
      case TokenType.HexString:
        return PDFObjects.str(token.value as string);

      case TokenType.DictBegin:
        return this.parseDictionary();

      case TokenType.ArrayBegin:
        return this.parseArray();

      case TokenType.Keyword:
        if (token.value === 'true') return PDFObjects.bool(true);
        if (token.value === 'false') return PDFObjects.bool(false);
        if (token.value === 'null') return PDFObjects.null();
        throw new PDFError('PDF_003', `Unexpected keyword "${token.value}" at offset ${token.offset}`);

      default:
        throw new PDFError('PDF_003', `Unexpected token type ${token.type} at offset ${token.offset}`);
    }
  }

  /** 解析字典 << /Key Value ... >> */
  parseDictionary(): PDFDictionary {
    const entries = new Map<string, PDFValue>();

    while (true) {
      const token = this.tokenizer.nextToken();
      if (token.type === TokenType.DictEnd) {
        break;
      }
      if (token.type === TokenType.EOF) {
        throw new PDFError('PDF_003', 'Unexpected EOF while parsing dictionary');
      }
      if (token.type !== TokenType.Name) {
        throw new PDFError('PDF_003', `Expected name key in dictionary but got token type ${token.type} at offset ${token.offset}`);
      }

      const key = token.value as string;
      const valueToken = this.tokenizer.nextToken();
      const value = this.parseValueFromToken(valueToken);
      entries.set(key, value);
    }

    return PDFObjects.dict(entries);
  }

  /** 解析数组 [ ... ] */
  parseArray(): PDFArray {
    const items: PDFValue[] = [];

    while (true) {
      const token = this.tokenizer.nextToken();
      if (token.type === TokenType.ArrayEnd) {
        break;
      }
      if (token.type === TokenType.EOF) {
        throw new PDFError('PDF_003', 'Unexpected EOF while parsing array');
      }
      const value = this.parseValueFromToken(token);
      items.push(value);
    }

    return PDFObjects.array(items);
  }

  /**
   * 解析间接对象 (N M obj ... endobj)
   * 返回对象号、版本号和值
   */
  parseIndirectObject(offset: number): { objNum: number; genNum: number; value: PDFValue } {
    this.tokenizer.seek(offset);
    const numToken = this.tokenizer.nextToken();
    if (numToken.type !== TokenType.Number) {
      throw new PDFError('PDF_003', `Expected object number at offset ${offset}`);
    }
    const genToken = this.tokenizer.nextToken();
    if (genToken.type !== TokenType.Number) {
      throw new PDFError('PDF_003', `Expected generation number at offset ${offset}`);
    }
    this.tokenizer.expectKeyword('obj');

    const value = this.parseValueAtCurrent();
    return { objNum: numToken.value as number, genNum: genToken.value as number, value };
  }

  /**
   * 解析流对象 (N M obj << dict >> stream <data> endstream endobj)
   * 返回对象号、版本号、字典和原始流数据
   */
  parseStreamObject(offset: number): { objNum: number; genNum: number; dictionary: PDFDictionary; streamData: Uint8Array } {
    const { objNum, genNum, value } = this.parseIndirectObject(offset);

    if (value.type !== 'dict') {
      throw new PDFError('PDF_003', `Expected dictionary for stream object at offset ${offset} but got ${value.type}`);
    }

    // 读取 /Length
    const lengthVal = value.entries.get('Length');
    let streamLength: number;
    if (lengthVal && lengthVal.type === 'number') {
      streamLength = lengthVal.value;
    } else {
      throw new PDFError('PDF_006', 'Stream /Length must be a direct number');
    }

    // 读取 "stream" 关键字
    this.tokenizer.skipWhitespace();
    this.tokenizer.expectKeyword('stream');

    // 跳过 "stream" 后的单个 EOL (CR, LF, or CRLF)
    const pos = this.tokenizer.position;
    if (pos < this.data.length) {
      if (this.data[pos] === 0x0d && this.data[pos + 1] === 0x0a) {
        this.tokenizer.seek(pos + 2);
      } else if (this.data[pos] === 0x0d || this.data[pos] === 0x0a) {
        this.tokenizer.seek(pos + 1);
      }
    }

    // 提取 /Length 字节的流数据
    const streamStart = this.tokenizer.position;
    const streamData = this.data.subarray(streamStart, streamStart + streamLength);

    return { objNum, genNum, dictionary: value, streamData };
  }

  get tokenizer_(): PDFTokenizer {
    return this.tokenizer;
  }
}
