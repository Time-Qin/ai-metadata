import { describe, it, expect } from 'vitest';
import { concat, equals, findBytes, findBytesReverse } from '@/utils/BufferUtil.js';
import { escapeXml, unescapeXml, escapePdfString, bytesToHex } from '@/utils/StringUtil.js';
import { encodeUtf8, decodeUtf8, encodeUtf16BE, decodeUtf16BE, encodeUtf16BEWithBOM, decodeUtf16BEWithBOM } from '@/utils/Encoding.js';

describe('BufferUtil', () => {
  it('concat 拼接多个 Uint8Array', () => {
    const result = concat(new Uint8Array([1]), new Uint8Array([2, 3]), new Uint8Array([4]));
    expect(Array.from(result)).toEqual([1, 2, 3, 4]);
  });

  it('equals 比较', () => {
    expect(equals(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true);
    expect(equals(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(false);
    expect(equals(new Uint8Array([1]), new Uint8Array([1, 2]))).toBe(false);
  });

  it('findBytes 正向查找', () => {
    const buf = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x50]);
    expect(findBytes(buf, new Uint8Array([0x50, 0x4b]))).toBe(0);
    expect(findBytes(buf, new Uint8Array([0x50]), 1)).toBe(5);
    expect(findBytes(buf, new Uint8Array([0xff]))).toBe(-1);
  });

  it('findBytesReverse 反向查找', () => {
    const buf = new Uint8Array([0x01, 0x02, 0x03, 0x01, 0x02]);
    expect(findBytesReverse(buf, new Uint8Array([0x01, 0x02]))).toBe(3);
  });
});

describe('StringUtil', () => {
  it('escapeXml 转义特殊字符', () => {
    expect(escapeXml('a<b>c&d"e')).toBe('a&lt;b&gt;c&amp;d&quot;e');
  });

  it('escapeXml 先转 & 再转其他', () => {
    expect(escapeXml('&lt;')).toBe('&amp;lt;');
  });

  it('unescapeXml 反转义', () => {
    expect(unescapeXml('a&lt;b&gt;c&amp;d&quot;e')).toBe('a<b>c&d"e');
  });

  it('escapePdfString 转义括号和反斜杠', () => {
    expect(escapePdfString('hello (world) \\ test')).toBe('hello \\(world\\) \\\\ test');
  });

  it('bytesToHex 转十六进制大写', () => {
    expect(bytesToHex(new Uint8Array([0xfe, 0xff, 0x0a]))).toBe('FEFF0A');
  });
});

describe('Encoding', () => {
  it('UTF-8 round-trip', () => {
    const str = 'Hello 世界 🌍';
    const encoded = encodeUtf8(str);
    expect(decodeUtf8(encoded)).toBe(str);
  });

  it('UTF-16BE round-trip', () => {
    const str = 'Hello 世界';
    const encoded = encodeUtf16BE(str);
    expect(decodeUtf16BE(encoded)).toBe(str);
  });

  it('UTF-16BE with BOM round-trip', () => {
    const str = 'AIGC 标识';
    const encoded = encodeUtf16BEWithBOM(str);
    expect(encoded[0]).toBe(0xfe);
    expect(encoded[1]).toBe(0xff);
    expect(decodeUtf16BEWithBOM(encoded)).toBe(str);
  });
});
