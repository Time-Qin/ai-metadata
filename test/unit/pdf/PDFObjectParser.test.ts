import { describe, it, expect } from 'vitest';
import { PDFObjectParser } from '@/pdf/PDFObjectParser';
import { PDFObjects } from '@/pdf/PDFObject';
import { encodeUtf8 } from '@/utils/Encoding';

describe('PDFObjectParser', () => {
  it('解析简单字典', () => {
    const data = encodeUtf8('<< /Type /Catalog /Pages 2 0 R >>');
    const parser = new PDFObjectParser(data);
    const value = parser.parseValue(0);

    expect(value.type).toBe('dict');
    if (value.type === 'dict') {
      const typeEntry = value.entries.get('Type');
      expect(typeEntry?.type).toBe('name');
      expect((typeEntry as { value: string }).value).toBe('Catalog');

      const pagesEntry = value.entries.get('Pages');
      expect(pagesEntry?.type).toBe('ref');
      expect((pagesEntry as { objNum: number }).objNum).toBe(2);
    }
  });

  it('解析数组', () => {
    const data = encodeUtf8('[1 2 3 /Name (string)]');
    const parser = new PDFObjectParser(data);
    const value = parser.parseValue(0);

    expect(value.type).toBe('array');
    if (value.type === 'array') {
      expect(value.items).toHaveLength(5);
      expect(value.items[0]!.type).toBe('number');
      expect(value.items[3]!.type).toBe('name');
      expect(value.items[4]!.type).toBe('string');
    }
  });

  it('解析间接引用', () => {
    const data = encodeUtf8('5 0 R');
    const parser = new PDFObjectParser(data);
    const value = parser.parseValue(0);

    expect(value.type).toBe('ref');
    if (value.type === 'ref') {
      expect(value.objNum).toBe(5);
      expect(value.genNum).toBe(0);
    }
  });

  it('区分数字和间接引用', () => {
    // 纯数字后面不是数字，所以不是引用
    const data = encodeUtf8('42 /Next');
    const parser = new PDFObjectParser(data);
    const value = parser.parseValue(0);
    expect(value.type).toBe('number');
    if (value.type === 'number') {
      expect(value.value).toBe(42);
    }
  });

  it('解析间接对象', () => {
    const data = encodeUtf8('1 0 obj\n<< /Type /Catalog >>\nendobj');
    const parser = new PDFObjectParser(data);
    const result = parser.parseIndirectObject(0);

    expect(result.objNum).toBe(1);
    expect(result.genNum).toBe(0);
    expect(result.value.type).toBe('dict');
  });

  it('解析布尔值和 null', () => {
    const data = encodeUtf8('true false null');
    const parser = new PDFObjectParser(data);

    const v1 = parser.parseValue(0);
    expect(v1.type).toBe('boolean');

    // Need to seek for the next value
    const v2 = parser.parseValueAtCurrent();
    expect(v2.type).toBe('boolean');

    const v3 = parser.parseValueAtCurrent();
    expect(v3.type).toBe('null');
  });

  it('解析嵌套字典', () => {
    const data = encodeUtf8('<< /Outer << /Inner /Value >> >>');
    const parser = new PDFObjectParser(data);
    const value = parser.parseValue(0);

    expect(value.type).toBe('dict');
    if (value.type === 'dict') {
      const outer = value.entries.get('Outer');
      expect(outer?.type).toBe('dict');
      if (outer?.type === 'dict') {
        const inner = outer.entries.get('Inner');
        expect(inner?.type).toBe('name');
        expect((inner as { value: string }).value).toBe('Value');
      }
    }
  });

  it('解析 Info Dictionary', () => {
    const pdf = '3 0 obj\n<<\n  /Producer (Test Producer)\n  /Creator (Test Creator)\n  /AIGC ({"Label":"AI"})\n>>\nendobj';
    const data = encodeUtf8(pdf);
    const parser = new PDFObjectParser(data);
    const result = parser.parseIndirectObject(0);

    expect(result.objNum).toBe(3);
    expect(result.value.type).toBe('dict');
    if (result.value.type === 'dict') {
      expect(result.value.entries.get('Producer')?.type).toBe('string');
      expect(result.value.entries.get('AIGC')?.type).toBe('string');
      const aigc = result.value.entries.get('AIGC');
      if (aigc?.type === 'string') {
        expect(aigc.value).toBe('{"Label":"AI"}');
      }
    }
  });
});
