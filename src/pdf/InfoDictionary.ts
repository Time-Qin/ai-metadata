/**
 * PDF Info Dictionary 读取与写入
 *
 * Info Dictionary 结构:
 * <<
 *   /Producer (...)
 *   /CreationDate (D:20260703100000)
 *   /AIGC ({"Label":"AI","ContentProducer":"ChatGPT"})
 * >>
 */

import { PDFValue, PDFDictionary, PDFString, PDFObjects } from './PDFObject';
import { PDFObjectParser } from './PDFObjectParser';
import { escapePdfString } from '@/utils/StringUtil';
import { encodeUtf16BEWithBOM } from '@/utils/Encoding';
import { bytesToHex } from '@/utils/StringUtil';
import { AIGC_PROPERTY_NAME } from '@/core/Constants';

/**
 * Info Dictionary 操作器
 */
export class InfoDictionary {
  private dict: PDFDictionary;

  constructor(dict?: PDFDictionary) {
    this.dict = dict ?? PDFObjects.dict();
  }

  /** 从 PDF 数据中解析 Info 对象 */
  static fromObject(data: Uint8Array, objOffset: number): InfoDictionary {
    const parser = new PDFObjectParser(data);
    const { value } = parser.parseIndirectObject(objOffset);
    if (value.type !== 'dict') {
      throw new Error(`Info object is not a dictionary (got ${value.type})`);
    }
    return new InfoDictionary(value);
  }

  /** 从已有 PDFDictionary 创建 */
  static fromDictionary(dict: PDFDictionary): InfoDictionary {
    return new InfoDictionary(dict);
  }

  /** 获取原始字典 */
  get dictionary(): PDFDictionary {
    return this.dict;
  }

  /** 获取指定字段的值 */
  get(key: string): string | null {
    const value = this.dict.entries.get(key);
    if (!value || value.type !== 'string') return null;
    return value.value;
  }

  /** 设置指定字段的值 */
  set(key: string, value: string): void {
    this.dict.entries.set(key, PDFObjects.str(value));
  }

  /** 判断字段是否存在 */
  has(key: string): boolean {
    return this.dict.entries.has(key);
  }

  /** 删除字段 */
  delete(key: string): void {
    this.dict.entries.delete(key);
  }

  /** 获取 AIGC 元数据 JSON 字符串 */
  getAIGC(): string | null {
    return this.get(AIGC_PROPERTY_NAME);
  }

  /** 设置 AIGC 元数据 JSON 字符串 */
  setAIGC(json: string): void {
    this.set(AIGC_PROPERTY_NAME, json);
  }

  /** 是否存在 AIGC 元数据 */
  hasAIGC(): boolean {
    return this.has(AIGC_PROPERTY_NAME);
  }

  /** 删除 AIGC 元数据 */
  deleteAIGC(): void {
    this.delete(AIGC_PROPERTY_NAME);
  }

  /** 获取所有条目 */
  entries(): IterableIterator<[string, PDFValue]> {
    return this.dict.entries.entries();
  }

  /**
   * 将 Info Dictionary 序列化为 PDF 对象字符串
   * @param objNum 对象号
   * @param genNum 版本号
   * @returns PDF 间接对象文本，如 "5 0 obj\n<< ... >>\nendobj\n"
   */
  serialize(objNum: number, genNum: number): string {
    const dictStr = this.serializeDictionary();
    return `${objNum} ${genNum} obj\n${dictStr}\nendobj\n`;
  }

  /** 序列化字典部分 */
  serializeDictionary(): string {
    const lines: string[] = ['<<'];

    for (const [key, value] of this.dict.entries) {
      lines.push(`  /${key} ${this.serializeValue(value)}`);
    }

    lines.push('>>');
    return lines.join('\n');
  }

  /** 序列化单个 PDF 值 */
  private serializeValue(value: PDFValue): string {
    switch (value.type) {
      case 'null':
        return 'null';
      case 'boolean':
        return value.value ? 'true' : 'false';
      case 'number':
        return String(value.value);
      case 'string':
        return this.serializeString(value);
      case 'name':
        return `/${value.value}`;
      case 'ref':
        return `${value.objNum} ${value.genNum} R`;
      case 'dict': {
        const subDict = InfoDictionary.fromDictionary(value);
        return subDict.serializeDictionary();
      }
      case 'array':
        return `[${value.items.map(v => this.serializeValue(v)).join(' ')}]`;
      default:
        return 'null';
    }
  }

  /**
   * 序列化 PDF 字符串
   * 对于纯 ASCII 文本使用 literal string: (...)
   * 对于包含非 ASCII 字符的使用 UTF-16BE hex string: <FE FF ...>
   */
  private serializeString(value: PDFString): string {
    const str = value.value;

    // 检查是否为纯 ASCII
    if (/^[\x00-\x7F]*$/.test(str)) {
      // 使用 literal string
      return `(${escapePdfString(str)})`;
    }

    // 使用 UTF-16BE hex string
    const bytes = encodeUtf16BEWithBOM(str);
    return `<${bytesToHex(bytes)}>`;
  }
}
