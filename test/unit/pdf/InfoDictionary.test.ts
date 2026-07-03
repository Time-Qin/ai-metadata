import { describe, it, expect } from 'vitest';
import { InfoDictionary } from '@/pdf/InfoDictionary';
import { PDFObjectParser } from '@/pdf/PDFObjectParser';
import { PDFObjects } from '@/pdf/PDFObject';
import { encodeUtf8 } from '@/utils/Encoding';

describe('InfoDictionary', () => {
  it('从 PDF 对象解析', () => {
    const pdf = '2 0 obj\n<<\n  /Producer (Test)\n  /AIGC ({"Label":"AI"})\n>>\nendobj';
    const data = encodeUtf8(pdf);
    const info = InfoDictionary.fromObject(data, 0);

    expect(info.get('Producer')).toBe('Test');
    expect(info.getAIGC()).toBe('{"Label":"AI"}');
    expect(info.hasAIGC()).toBe(true);
  });

  it('设置和获取字段', () => {
    const info = new InfoDictionary();
    info.set('Producer', 'My App');
    info.setAIGC('{"Label":"test"}');

    expect(info.get('Producer')).toBe('My App');
    expect(info.getAIGC()).toBe('{"Label":"test"}');
  });

  it('删除字段', () => {
    const info = new InfoDictionary();
    info.setAIGC('test');
    expect(info.hasAIGC()).toBe(true);

    info.deleteAIGC();
    expect(info.hasAIGC()).toBe(false);
    expect(info.getAIGC()).toBeNull();
  });

  it('序列化 ASCII 字符串', () => {
    const info = new InfoDictionary();
    info.set('Producer', 'Test App');
    info.setAIGC('{"Label":"AI"}');

    const serialized = info.serialize(5, 0);

    expect(serialized).toContain('5 0 obj');
    expect(serialized).toContain('endobj');
    expect(serialized).toContain('/Producer (Test App)');
    expect(serialized).toContain('/AIGC ({"Label":"AI"})');
  });

  it('序列化非 ASCII 字符串为 UTF-16BE hex', () => {
    const info = new InfoDictionary();
    info.set('Title', '中文标题');

    const serialized = info.serialize(3, 0);

    // UTF-16BE hex string: <FE FF ...>
    expect(serialized).toContain('/Title <FEFF');
  });

  it('转义 PDF 字符串中的特殊字符', () => {
    const info = new InfoDictionary();
    info.set('Test', 'hello (world) \\ test');

    const serialized = info.serialize(1, 0);

    expect(serialized).toContain('(hello \\(world\\) \\\\ test)');
  });

  it('从现有字典创建', () => {
    const dict = PDFObjects.dict(new Map([
      ['Producer', PDFObjects.str('Existing')],
      ['AIGC', PDFObjects.str('{"Label":"old"}')],
    ]));

    const info = InfoDictionary.fromDictionary(dict);

    expect(info.get('Producer')).toBe('Existing');
    expect(info.getAIGC()).toBe('{"Label":"old"}');
  });

  it('保留已有字段并添加 AIGC', () => {
    const pdf = '2 0 obj\n<<\n  /Producer (Existing)\n  /Creator (MyTool)\n>>\nendobj';
    const data = encodeUtf8(pdf);
    const info = InfoDictionary.fromObject(data, 0);

    info.setAIGC('{"Label":"new"}');

    const serialized = info.serialize(2, 0);

    expect(serialized).toContain('/Producer (Existing)');
    expect(serialized).toContain('/Creator (MyTool)');
    expect(serialized).toContain('/AIGC ({"Label":"new"})');
  });

  it('遍历所有条目', () => {
    const info = new InfoDictionary();
    info.set('A', '1');
    info.set('B', '2');

    const entries = Array.from(info.entries());
    expect(entries).toHaveLength(2);
  });

  it('序列化字典结构', () => {
    const info = new InfoDictionary();
    info.set('Producer', 'Test');

    const dictStr = info.serializeDictionary();

    expect(dictStr).toContain('<<');
    expect(dictStr).toContain('>>');
    expect(dictStr).toContain('/Producer (Test)');
  });
});
