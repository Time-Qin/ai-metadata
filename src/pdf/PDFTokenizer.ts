/**
 * PDF 词法分析器
 * 将 PDF 字节流切分为 token
 */

import { PDFError } from '@/errors/PDFError';
import { decodeUtf16BEWithBOM } from '@/utils/Encoding';

/** Token 类型 */
export enum TokenType {
  Number,
  Name,
  LiteralString,
  HexString,
  Keyword,
  DictBegin, // <<
  DictEnd, // >>
  ArrayBegin, // [
  ArrayEnd, // ]
  EOF,
}

/** Token */
export interface Token {
  type: TokenType;
  value: string | number;
  offset: number;
}

/** PDF 空白字符 */
function isWhitespace(byte: number): boolean {
  return byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d || byte === 0x0c || byte === 0x00;
}

/** PDF 分隔符 */
function isDelimiter(byte: number): boolean {
  return byte === 0x28 || byte === 0x29 || byte === 0x3c || byte === 0x3e || byte === 0x5b || byte === 0x5d || byte === 0x7b || byte === 0x7d || byte === 0x2f || byte === 0x25;
}

/** 数字字符 */
function isDigit(byte: number): boolean {
  return byte >= 0x30 && byte <= 0x39;
}

/** 数字相关字符（包括 + - .） */
function isNumericChar(byte: number): boolean {
  return isDigit(byte) || byte === 0x2b || byte === 0x2d || byte === 0x2e;
}

/** 常规字符（非空白、非分隔符） */
function isRegular(byte: number): boolean {
  return !isWhitespace(byte) && !isDelimiter(byte);
}

/**
 * PDF 词法分析器
 * 从 Uint8Array 中按需产生 token
 */
export class PDFTokenizer {
  private readonly data: Uint8Array;
  private pos: number;
  readonly length: number;

  constructor(data: Uint8Array, startPos = 0) {
    this.data = data;
    this.pos = startPos;
    this.length = data.length;
  }

  get position(): number {
    return this.pos;
  }

  seek(pos: number): void {
    this.pos = pos;
  }

  /** 跳过空白和注释 */
  skipWhitespace(): void {
    while (this.pos < this.length) {
      const byte = this.data[this.pos]!;
      if (isWhitespace(byte)) {
        this.pos++;
      } else if (byte === 0x25) {
        // 注释：跳到行尾
        while (this.pos < this.length && this.data[this.pos] !== 0x0a && this.data[this.pos] !== 0x0d) {
          this.pos++;
        }
      } else {
        break;
      }
    }
  }

  /** 读取下一个 token */
  nextToken(): Token {
    this.skipWhitespace();
    if (this.pos >= this.length) {
      return { type: TokenType.EOF, value: '', offset: this.pos };
    }

    const offset = this.pos;
    const byte = this.data[this.pos]!;

    // << 字典开始
    if (byte === 0x3c && this.data[this.pos + 1] === 0x3c) {
      this.pos += 2;
      return { type: TokenType.DictBegin, value: '<<', offset };
    }

    // >> 字典结束
    if (byte === 0x3e && this.data[this.pos + 1] === 0x3e) {
      this.pos += 2;
      return { type: TokenType.DictEnd, value: '>>', offset };
    }

    // < 十六进制字符串开始
    if (byte === 0x3c) {
      const value = this.readHexString();
      return { type: TokenType.HexString, value, offset };
    }

    // > 单个 > （不应该单独出现，但跳过）
    if (byte === 0x3e) {
      this.pos++;
      return this.nextToken();
    }

    // ( 字面字符串
    if (byte === 0x28) {
      const value = this.readLiteralString();
      return { type: TokenType.LiteralString, value, offset };
    }

    // ) 单个 ) 跳过
    if (byte === 0x29) {
      this.pos++;
      return this.nextToken();
    }

    // [ 数组开始
    if (byte === 0x5b) {
      this.pos++;
      return { type: TokenType.ArrayBegin, value: '[', offset };
    }

    // ] 数组结束
    if (byte === 0x5d) {
      this.pos++;
      return { type: TokenType.ArrayEnd, value: ']', offset };
    }

    // / Name
    if (byte === 0x2f) {
      const value = this.readName();
      return { type: TokenType.Name, value, offset };
    }

    // { 或 } 跳过（代码块，不常用）
    if (byte === 0x7b || byte === 0x7d) {
      this.pos++;
      return this.nextToken();
    }

    // 数字
    if (isNumericChar(byte)) {
      const value = this.readNumber();
      return { type: TokenType.Number, value, offset };
    }

    // 关键字（true, false, null, obj, endobj, R, etc.）
    if (isRegular(byte)) {
      const value = this.readKeyword();
      return { type: TokenType.Keyword, value, offset };
    }

    // 未知字符，跳过
    this.pos++;
    return this.nextToken();
  }

  /** 预读下一个 token 但不消费 */
  peekToken(): Token {
    const savedPos = this.pos;
    const token = this.nextToken();
    this.pos = savedPos;
    return token;
  }

  private readName(): string {
    this.pos++; // 跳过 /
    let result = '';
    while (this.pos < this.length) {
      const byte = this.data[this.pos]!;
      if (isWhitespace(byte) || isDelimiter(byte)) {
        break;
      }
      if (byte === 0x23) {
        // # 后跟两个十六进制字符
        const hex1 = this.data[this.pos + 1];
        const hex2 = this.data[this.pos + 2];
        if (hex1 !== undefined && hex2 !== undefined) {
          const code = parseInt(String.fromCharCode(hex1, hex2), 16);
          result += String.fromCharCode(code);
          this.pos += 3;
        } else {
          result += '#';
          this.pos++;
        }
      } else {
        result += String.fromCharCode(byte);
        this.pos++;
      }
    }
    return result;
  }

  private readNumber(): number {
    let str = '';
    while (this.pos < this.length) {
      const byte = this.data[this.pos]!;
      if (isNumericChar(byte)) {
        str += String.fromCharCode(byte);
        this.pos++;
      } else {
        break;
      }
    }
    return parseFloat(str);
  }

  private readLiteralString(): string {
    this.pos++; // 跳过 (
    const byteList: number[] = [];
    let depth = 1;
    while (this.pos < this.length && depth > 0) {
      const byte = this.data[this.pos]!;
      if (byte === 0x5c) {
        // 反斜杠转义
        this.pos++;
        if (this.pos >= this.length) break;
        const next = this.data[this.pos]!;
        switch (next) {
          case 0x6e: byteList.push(0x0a); break; // \n
          case 0x72: byteList.push(0x0d); break; // \r
          case 0x74: byteList.push(0x09); break; // \t
          case 0x62: byteList.push(0x08); break; // \b
          case 0x66: byteList.push(0x0c); break; // \f
          case 0x28: byteList.push(0x28); break; // \(
          case 0x29: byteList.push(0x29); break; // \)
          case 0x5c: byteList.push(0x5c); break; // \\
          case 0x0a: break; // 行继续
          case 0x0d:
            // \r 或 \r\n
            if (this.data[this.pos + 1] === 0x0a) this.pos++;
            break;
          default:
            if (next >= 0x30 && next <= 0x37) {
              // 八进制转义 \ddd
              let octal = String.fromCharCode(next);
              this.pos++;
              for (let i = 0; i < 2 && this.pos < this.length; i++) {
                const b = this.data[this.pos]!;
                if (b >= 0x30 && b <= 0x37) {
                  octal += String.fromCharCode(b);
                  this.pos++;
                } else {
                  break;
                }
              }
              this.pos--; // 回退一个，因为循环末尾会 ++
              byteList.push(parseInt(octal, 8) & 0xff);
            } else {
              byteList.push(next);
            }
        }
        this.pos++;
      } else if (byte === 0x28) {
        depth++;
        byteList.push(0x28);
        this.pos++;
      } else if (byte === 0x29) {
        depth--;
        if (depth > 0) byteList.push(0x29);
        this.pos++;
      } else {
        byteList.push(byte);
        this.pos++;
      }
    }
    // 转为 Uint8Array
    const bytes = new Uint8Array(byteList);
    // 检查是否为 UTF-16BE (BOM: FE FF)
    if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
      return decodeUtf16BEWithBOM(bytes);
    }
    // 否则按 Latin-1 解码
    let result = '';
    for (let i = 0; i < bytes.length; i++) {
      result += String.fromCharCode(bytes[i]!);
    }
    return result;
  }

  private readHexString(): string {
    this.pos++; // 跳过 <
    let hex = '';
    while (this.pos < this.length) {
      const byte = this.data[this.pos]!;
      if (byte === 0x3e) {
        this.pos++;
        break;
      }
      if (!isWhitespace(byte)) {
        hex += String.fromCharCode(byte);
      }
      this.pos++;
    }
    // 奇数长度补 0
    if (hex.length % 2 !== 0) hex += '0';
    // 转为字节数组
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    // 检查是否为 UTF-16BE (BOM: FE FF)
    if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
      return decodeUtf16BEWithBOM(bytes);
    }
    // 否则按 Latin-1 解码（每字节一个字符）
    let result = '';
    for (let i = 0; i < bytes.length; i++) {
      result += String.fromCharCode(bytes[i]!);
    }
    return result;
  }

  private readKeyword(): string {
    let result = '';
    while (this.pos < this.length) {
      const byte = this.data[this.pos]!;
      if (isWhitespace(byte) || isDelimiter(byte)) {
        break;
      }
      result += String.fromCharCode(byte);
      this.pos++;
    }
    return result;
  }

  /**
   * 读取从当前位置到下一个换行的原始文本行（不含换行符）
   * 用于 xref 表行解析
   */
  readLine(): string {
    let result = '';
    while (this.pos < this.length) {
      const byte = this.data[this.pos]!;
      if (byte === 0x0a || byte === 0x0d) {
        // 处理 \r\n
        if (byte === 0x0d && this.data[this.pos + 1] === 0x0a) {
          this.pos++;
        }
        this.pos++;
        break;
      }
      result += String.fromCharCode(byte);
      this.pos++;
    }
    return result;
  }

  /** 从当前位置读取到指定字节模式 */
  readUntil(pattern: Uint8Array): string {
    let result = '';
    const start = this.pos;
    while (this.pos < this.length) {
      let match = true;
      for (let i = 0; i < pattern.length; i++) {
        if (this.data[this.pos + i] !== pattern[i]) {
          match = false;
          break;
        }
      }
      if (match) {
        break;
      }
      result += String.fromCharCode(this.data[this.pos]!);
      this.pos++;
    }
    void start;
    return result;
  }

  /** 期望下一个 token 是指定关键字 */
  expectKeyword(keyword: string): Token {
    const token = this.nextToken();
    if (token.type !== TokenType.Keyword || token.value !== keyword) {
      throw new PDFError('PDF_003', `Expected keyword "${keyword}" but got "${token.value}" at offset ${token.offset}`);
    }
    return token;
  }
}
