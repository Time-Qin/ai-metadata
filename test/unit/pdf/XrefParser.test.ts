import { describe, it, expect } from 'vitest';
import { XrefParser } from '@/pdf/XrefParser';
import { encodeUtf8 } from '@/utils/Encoding';

describe('XrefParser', () => {
  it('解析基本 xref 表', () => {
    const xrefText = [
      'xref',
      '0 3',
      '0000000000 65535 f ',
      '0000000015 00000 n ',
      '0000000100 00000 n ',
    ].join('\n');
    const data = encodeUtf8(xrefText);

    const xref = XrefParser.parse(data, 0);

    expect(xref.entries.size).toBe(3);
    expect(xref.entries.get(0)?.offset).toBe(0);
    expect(xref.entries.get(0)?.inUse).toBe(false);
    expect(xref.entries.get(1)?.offset).toBe(15);
    expect(xref.entries.get(1)?.inUse).toBe(true);
    expect(xref.entries.get(2)?.offset).toBe(100);
    expect(xref.entries.get(2)?.generation).toBe(0);
  });

  it('解析多段 xref 表', () => {
    const xrefText = [
      'xref',
      '0 2',
      '0000000000 65535 f ',
      '0000000015 00000 n ',
      '3 1',
      '0000000200 00000 n ',
    ].join('\n');
    const data = encodeUtf8(xrefText);

    const xref = XrefParser.parse(data, 0);

    expect(xref.entries.size).toBe(3);
    expect(xref.entries.get(0)?.offset).toBe(0);
    expect(xref.entries.get(1)?.offset).toBe(15);
    expect(xref.entries.get(3)?.offset).toBe(200);
  });

  it('解析带 generation 的条目', () => {
    const xrefText = [
      'xref',
      '0 2',
      '0000000000 65535 f ',
      '0000000015 00003 n ',
    ].join('\n');
    const data = encodeUtf8(xrefText);

    const xref = XrefParser.parse(data, 0);

    expect(xref.entries.get(1)?.generation).toBe(3);
  });

  it('在 trailer 前停止', () => {
    const xrefText = [
      'xref',
      '0 1',
      '0000000000 65535 f ',
      'trailer',
      '<< /Size 1 >>',
    ].join('\n');
    const data = encodeUtf8(xrefText);

    const xref = XrefParser.parse(data, 0);

    expect(xref.entries.size).toBe(1);
  });
});
