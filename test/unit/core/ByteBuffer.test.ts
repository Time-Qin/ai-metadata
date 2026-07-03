import { describe, it, expect } from 'vitest';
import { ByteBuffer } from '@/core/ByteBuffer.js';

describe('ByteBuffer', () => {
  it('append 和 toArrayBuffer', () => {
    const bb = new ByteBuffer();
    bb.append(new Uint8Array([1, 2, 3]));
    bb.append(new Uint8Array([4, 5]));
    expect(bb.size).toBe(5);
    const arr = new Uint8Array(bb.toArrayBuffer());
    expect(Array.from(arr)).toEqual([1, 2, 3, 4, 5]);
  });

  it('空 buffer size 为 0', () => {
    const bb = new ByteBuffer();
    expect(bb.size).toBe(0);
  });
});
