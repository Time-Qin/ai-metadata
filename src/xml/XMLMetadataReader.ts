import { VT_LPWSTR, PROPERTY_TAG } from './XMLNamespace';

/**
 * XML Metadata 读取器
 * 从 custom.xml 的 Document 中读取 property
 */
export class XMLMetadataReader {
  constructor(private doc: Document) {}

  /**
   * 按 name 查找 property，返回其文本值
   * 不存在返回 null
   */
  getProperty(name: string): string | null {
    const root = this.doc.documentElement;
    if (!root) return null;

    const children = root.children;
    for (let i = 0; i < children.length; i++) {
      const prop = children[i]!;
      if (prop.tagName === PROPERTY_TAG && prop.getAttribute('name') === name) {
        // 查找 vt:lpwstr 子元素
        const lpwstr = prop.getElementsByTagName(VT_LPWSTR);
        if (lpwstr.length > 0) {
          return lpwstr[0]!.textContent;
        }
        // 兜底：查找不带前缀的 lpwstr
        const fallback = prop.getElementsByTagName('lpwstr');
        if (fallback.length > 0) {
          return fallback[0]!.textContent;
        }
        return prop.textContent;
      }
    }
    return null;
  }

  /**
   * 列出所有 property
   */
  listProperties(): Array<{ name: string; pid: number; fmtid: string; value: string }> {
    const result: Array<{ name: string; pid: number; fmtid: string; value: string }> = [];
    const root = this.doc.documentElement;
    if (!root) return result;

    const children = root.children;
    for (let i = 0; i < children.length; i++) {
      const prop = children[i]!;
      if (prop.tagName !== PROPERTY_TAG) continue;

      const name = prop.getAttribute('name') ?? '';
      const pid = parseInt(prop.getAttribute('pid') ?? '0', 10);
      const fmtid = prop.getAttribute('fmtid') ?? '';

      let value = '';
      const lpwstr = prop.getElementsByTagName(VT_LPWSTR);
      if (lpwstr.length > 0) {
        value = lpwstr[0]!.textContent ?? '';
      } else {
        const fallback = prop.getElementsByTagName('lpwstr');
        if (fallback.length > 0) {
          value = fallback[0]!.textContent ?? '';
        }
      }

      result.push({ name, pid, fmtid, value });
    }
    return result;
  }
}
