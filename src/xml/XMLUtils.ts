import { XMLParseError } from '@/errors/XMLParseError';

/**
 * XML 工具：解析、序列化、转义
 */
export class XMLUtils {
  private static parser: DOMParser | null = null;
  private static serializer: XMLSerializer | null = null;

  /**
   * 解析 XML 字符串为 Document
   * 解析失败抛出 XMLParseError
   */
  static parse(xml: string): Document {
    if (!this.parser) {
      this.parser = new DOMParser();
    }
    let doc: Document;
    try {
      doc = this.parser.parseFromString(xml, 'application/xml');
    } catch (e) {
      throw new XMLParseError('XML_001', `XML parse failed: ${(e as Error).message}`);
    }

    // 检查解析错误（浏览器 DOMParser 返回 <parsererror> 元素）
    const parserError = doc.getElementsByTagName('parsererror');
    if (parserError.length > 0) {
      throw new XMLParseError('XML_001', `XML parse failed: ${parserError[0]!.textContent}`);
    }

    return doc;
  }

  /**
   * 将 Document 序列化为 XML 字符串
   * 包含 XML 声明
   */
  static stringify(doc: Document): string {
    if (!this.serializer) {
      this.serializer = new XMLSerializer();
    }
    const xml = this.serializer.serializeToString(doc);

    // 确保有 XML 声明
    if (!xml.startsWith('<?xml')) {
      return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + xml;
    }

    return xml;
  }

  /**
   * XML 转义
   * 必须先转 & 再转其他
   */
  static escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * XML 反转义
   */
  static unescapeXml(str: string): string {
    return str
      .replace(/&quot;/g, '"')
      .replace(/&gt;/g, '>')
      .replace(/&lt;/g, '<')
      .replace(/&amp;/g, '&');
  }
}
