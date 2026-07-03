import { describe, it, expect } from 'vitest';
import { CRC32 } from '@/core/CRC32';

describe('CRC32', () => {
  it('标准向量 "123456789" 应返回 0xCBF43926', () => {
    const data = new TextEncoder().encode('123456789');
    const result = CRC32.compute(data);
    expect(result).toBe(0xCBF43926);
  });

  it('空数据应返回 0', () => {
    const result = CRC32.compute(new Uint8Array(0));
    expect(result).toBe(0);
  });

  it('同一数据多次调用结果一致', () => {
    const data = new TextEncoder().encode('hello world');
    const r1 = CRC32.compute(data);
    const r2 = CRC32.compute(data);
    expect(r1).toBe(r2);
  });

  it('返回值是 unsigned 32-bit', () => {
    const data = new TextEncoder().encode('test data for crc');
    const result = CRC32.compute(data);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(0xFFFFFFFF);
  });
});
