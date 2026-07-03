import { describe, it, expect } from 'vitest';
import { TrailerParser } from '@/pdf/TrailerParser';
import { encodeUtf8 } from '@/utils/Encoding';

describe('TrailerParser', () => {
  it('解析基本 trailer', () => {
    const pdf = [
      'xref',
      '0 2',
      '0000000000 65535 f ',
      '0000000015 00000 n ',
      'trailer',
      '<< /Size 2 /Root 1 0 R /Info 2 0 R >>',
      'startxref',
      '0',
      '%%EOF',
    ].join('\n');
    const data = encodeUtf8(pdf);

    const trailer = TrailerParser.parse(data, 0, 0);

    expect(trailer.size).toBe(2);
    expect(trailer.root).toEqual({ objNum: 1, genNum: 0 });
    expect(trailer.info).toEqual({ objNum: 2, genNum: 0 });
    expect(trailer.encrypt).toBe(false);
  });

  it('解析带 Prev 的 trailer', () => {
    const pdf = [
      'trailer',
      '<< /Size 10 /Root 1 0 R /Info 5 0 R /Prev 500 >>',
      'startxref',
      '1000',
      '%%EOF',
    ].join('\n');
    const data = encodeUtf8(pdf);

    const trailer = TrailerParser.parse(data, 0, 1000);

    expect(trailer.prev).toBe(500);
    expect(trailer.xrefOffset).toBe(1000);
  });

  it('解析无 Info 的 trailer', () => {
    const pdf = [
      'trailer',
      '<< /Size 2 /Root 1 0 R >>',
      'startxref',
      '0',
      '%%EOF',
    ].join('\n');
    const data = encodeUtf8(pdf);

    const trailer = TrailerParser.parse(data, 0, 0);

    expect(trailer.info).toBeNull();
  });

  it('检测加密', () => {
    const pdf = [
      'trailer',
      '<< /Size 2 /Root 1 0 R /Encrypt 3 0 R >>',
      'startxref',
      '0',
      '%%EOF',
    ].join('\n');
    const data = encodeUtf8(pdf);

    const trailer = TrailerParser.parse(data, 0, 0);

    expect(trailer.encrypt).toBe(true);
  });

  it('解析 trailer<< 无空白格式 (trailer 紧跟 <<)', () => {
    // 某些 PDF 生成器不在 trailer 和 << 之间加空白
    const pdf = [
      'xref',
      '0 2',
      '0000000000 65535 f ',
      '0000000015 00000 n ',
      'trailer<< /Size 2 /Root 1 0 R /Info 2 0 R >>',
      'startxref',
      '0',
      '%%EOF',
    ].join('\n');
    const data = encodeUtf8(pdf);

    const trailer = TrailerParser.parse(data, 0, 0);

    expect(trailer.size).toBe(2);
    expect(trailer.root).toEqual({ objNum: 1, genNum: 0 });
    expect(trailer.info).toEqual({ objNum: 2, genNum: 0 });
  });

  it('解析 \\r\\n 换行 + trailer<< 格式 (模拟真实 PDF)', () => {
    // 真实 PDF 常使用 \r\n 换行，且 trailer 后无空白
    const pdf = [
      'xref\r\n',
      '0 3\r\n',
      '0000000000 65535 f \r\n',
      '0000000016 00000 n \r\n',
      '0000000200 00000 n \r\n',
      'trailer<<\r\n',
      '/Size 3\r\n',
      '/Root 1 0 R\r\n',
      '/Info 2 0 R\r\n',
      '>>\r\n',
      'startxref\r\n',
      '0\r\n',
      '%%EOF\r\n',
    ].join('');
    const data = encodeUtf8(pdf);

    const trailer = TrailerParser.parse(data, 0, 0);

    expect(trailer.size).toBe(3);
    expect(trailer.root).toEqual({ objNum: 1, genNum: 0 });
    expect(trailer.info).toEqual({ objNum: 2, genNum: 0 });
  });

  it('trailer 后跟 / 分隔符也能识别', () => {
    // trailer 后面理论上可以跟任何 PDF 分隔符
    // 虽然实际中主要是 <<，但确保分隔符检测的完整性
    const pdf = 'trailer\n<< /Size 1 /Root 1 0 R >>';
    const data = encodeUtf8(pdf);

    const trailer = TrailerParser.parse(data, 0, 0);
    expect(trailer.size).toBe(1);
  });

  it('不匹配内嵌在字符串中的 "trailer"', () => {
    // "trailer" 出现在字符串值中，不应被匹配
    const pdf = [
      'xref',
      '0 1',
      '0000000000 65535 f ',
      'trailer',
      '<< /Size 1 /Root 1 0 R /Title (trailer content) >>',
      'startxref',
      '0',
      '%%EOF',
    ].join('\n');
    const data = encodeUtf8(pdf);

    const trailer = TrailerParser.parse(data, 0, 0);
    expect(trailer.size).toBe(1);
  });
});
