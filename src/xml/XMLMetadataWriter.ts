import { PROPERTIES_NS, VT_NS, VT_LPWSTR, PROPERTY_TAG, PROPERTIES_TAG } from './XMLNamespace';

/**
 * XML Metadata 写入器
 * 在 custom.xml 的 Document 中创建/更新/删除 property
 */
export class XMLMetadataWriter {
  constructor(private doc: Document) {}

  /**
   * 设置 property（存在则覆盖，不存在则创建）
   */
  setProperty(name: string, value: string, fmtid: string, pid: number): void {
    // 先删除同名的 property
    this.removeProperty(name);

    // 获取根元素 Properties
    const root = this.doc.documentElement;

    // 创建 property 元素
    const prop = this.doc.createElementNS(PROPERTIES_NS, PROPERTY_TAG);
    prop.setAttribute('name', name);
    prop.setAttribute('fmtid', fmtid);
    prop.setAttribute('pid', String(pid));

    // 创建 vt:lpwstr 子元素
    const vt = this.doc.createElementNS(VT_NS, VT_LPWSTR);
    vt.textContent = value;
    prop.appendChild(vt);

    root.appendChild(prop);
  }

  /**
   * 删除指定 name 的 property
   * 返回是否删除了
   */
  removeProperty(name: string): boolean {
    // 遍历根元素的子元素查找
    const root = this.doc.documentElement;
    const children = root.children;
    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i]!;
      if (child.tagName === PROPERTY_TAG && child.getAttribute('name') === name) {
        root.removeChild(child);
        return true;
      }
    }
    return false;
  }

  /**
   * 判断指定 name 的 property 是否存在
   */
  hasProperty(name: string): boolean {
    const root = this.doc.documentElement;
    const children = root.children;
    for (let i = 0; i < children.length; i++) {
      const child = children[i]!;
      if (child.tagName === PROPERTY_TAG && child.getAttribute('name') === name) {
        return true;
      }
    }
    return false;
  }

  /**
   * 获取根元素标签名（用于调试）
   */
  get rootTag(): string {
    return this.doc.documentElement?.tagName ?? PROPERTIES_TAG;
  }
}
