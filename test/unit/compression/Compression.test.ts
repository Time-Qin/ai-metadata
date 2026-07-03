import { describe, it, expect } from 'vitest';
import { CompressionFactory } from '@/compression/CompressionFactory';
import { BrowserCompression } from '@/compression/BrowserCompression';
import { FallbackCompression } from '@/compression/BrowserCompression';
import { deflateRawSync, inflateRawSync, deflateSync } from 'node:zlib';

describe('Compression', () => {
  it('compress → decompress round-trip', async () => {
    const adapter = CompressionFactory.create();
    const data = new TextEncoder().encode('Hello World! 这是一个测试。'.repeat(100));
    const compressed = await adapter.compress(data);
    const decompressed = await adapter.decompress(compressed);
    expect(decompressed).toEqual(data);
  });

  it('compress 输出是 raw deflate（非 gzip、非 zlib）', async () => {
    const adapter = CompressionFactory.create();
    const data = new TextEncoder().encode('test data for format verification');
    const compressed = await adapter.compress(data);
    // gzip magic: 0x1f 0x8b
    expect(compressed[0]).not.toBe(0x1f);
    // zlib header: 0x78 (CM=8, CINFO=7)
    expect(compressed[0]).not.toBe(0x78);
  });

  it('compress 空数据', async () => {
    const adapter = CompressionFactory.create();
    const data = new Uint8Array(0);
    const compressed = await adapter.compress(data);
    const decompressed = await adapter.decompress(compressed);
    expect(decompressed).toEqual(data);
  });
});

describe('Compression: raw DEFLATE 交叉验证', () => {
  /**
   * 使用 Node.js zlib 模块生成独立的 raw DEFLATE 数据
   * 验证 SDK 的 compress/decompress 与标准实现兼容
   */

  it('SDK decompress 能解压 Node.js zlib.deflateRawSync 的输出', async () => {
    const adapter = CompressionFactory.create();
    const original = new TextEncoder().encode('AIGC metadata injection test — 中文测试 🎉');
    const compressed = new Uint8Array(deflateRawSync(original));

    const decompressed = await adapter.decompress(compressed);
    expect(decompressed).toEqual(original);
  });

  it('SDK compress 的输出能被 Node.js zlib.inflateRawSync 解压', async () => {
    const adapter = CompressionFactory.create();
    const original = new TextEncoder().encode('Cross-validation: SDK compress → Node.js inflate');
    const compressed = await adapter.compress(original);

    const decompressed = inflateRawSync(compressed);
    expect(new Uint8Array(decompressed)).toEqual(original);
  });

  it('SDK compress 输出不含 zlib 头部 (0x78)', async () => {
    const adapter = CompressionFactory.create();
    const data = new TextEncoder().encode('check no zlib header');
    const compressed = await adapter.compress(data);
    // raw DEFLATE 数据的第一个字节不应该是 0x78 (zlib header)
    expect(compressed[0]).not.toBe(0x78);
    // 对比：zlib 格式的第一个字节应该是 0x78
    const zlibData = deflateRawSync(data); // 这实际上是 raw deflate
    // 用 deflateSync 验证 zlib 格式的头
    // (不导入 deflateSync 以保持简洁，仅验证 compressed 不以 0x78 开头)
    expect(compressed[0]).not.toBe(0x78);
    expect(zlibData[0]).not.toBe(0x78); // deflateRawSync 也不应该有 0x78 头
  });

  it('大文件 round-trip (100KB)', async () => {
    const adapter = CompressionFactory.create();
    // 生成 100KB 随机数据
    const data = new Uint8Array(100 * 1024);
    for (let i = 0; i < data.length; i++) {
      data[i] = i % 256;
    }
    const compressed = await adapter.compress(data);
    const decompressed = await adapter.decompress(compressed);
    expect(decompressed).toEqual(data);
  });

  it('二进制数据 round-trip', async () => {
    const adapter = CompressionFactory.create();
    // 包含所有 0-255 字节值的数据
    const data = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      data[i] = i;
    }
    const compressed = await adapter.compress(data);
    const decompressed = await adapter.decompress(compressed);
    expect(decompressed).toEqual(data);
  });
});

describe('Compression: BrowserCompression 直接测试', () => {
  it('BrowserCompression 实例化不报错', () => {
    expect(() => new BrowserCompression()).not.toThrow();
  });

  it('FallbackCompression 抛出 CompressionError', async () => {
    const fallback = new FallbackCompression();
    await expect(fallback.compress(new Uint8Array(1))).rejects.toThrow();
    await expect(fallback.decompress(new Uint8Array(1))).rejects.toThrow();
  });
});

describe('Compression: 多轮 compress/decompress 一致性', () => {
  it('连续多次 compress 结果可被 decompress 还原', async () => {
    const adapter = CompressionFactory.create();
    const data = new TextEncoder().encode('multi-round consistency test 多轮一致性测试');

    for (let i = 0; i < 5; i++) {
      const compressed = await adapter.compress(data);
      const decompressed = await adapter.decompress(compressed);
      expect(decompressed).toEqual(data);
    }
  });
});

describe('Compression: zlib 格式自动检测', () => {
  /**
   * decompress 应自动检测输入格式:
   *  - zlib 格式 (RFC 1950, 首字节 0x78, PDF /FlateDecode 使用)
   *  - raw DEFLATE 格式 (RFC 1951, ZIP method 8 使用)
   */

  it('decompress 自动识别 zlib 格式 (deflateSync 输出)', async () => {
    const adapter = CompressionFactory.create();
    const original = new TextEncoder().encode('PDF FlateDecode zlib format test 中文');
    // deflateSync 输出 zlib 格式 (RFC 1950), 首字节为 0x78
    const zlibCompressed = new Uint8Array(deflateSync(original));
    expect(zlibCompressed[0]).toBe(0x78);

    const decompressed = await adapter.decompress(zlibCompressed);
    expect(decompressed).toEqual(original);
  });

  it('decompress 自动识别 raw DEFLATE 格式 (deflateRawSync 输出)', async () => {
    const adapter = CompressionFactory.create();
    const original = new TextEncoder().encode('ZIP raw DEFLATE format test 中文');
    // deflateRawSync 输出 raw DEFLATE (RFC 1951), 首字节不是 0x78
    const rawCompressed = new Uint8Array(deflateRawSync(original));
    expect(rawCompressed[0]).not.toBe(0x78);

    const decompressed = await adapter.decompress(rawCompressed);
    expect(decompressed).toEqual(original);
  });

  it('compress 输出始终为 raw DEFLATE，可被 inflateRawSync 解压', async () => {
    const adapter = CompressionFactory.create();
    const original = new TextEncoder().encode('compress output must always be raw DEFLATE');
    const compressed = await adapter.compress(original);

    expect(compressed[0]).not.toBe(0x78);
    const decompressed = inflateRawSync(compressed);
    expect(new Uint8Array(decompressed)).toEqual(original);
  });

  it('zlib 和 raw 格式解压后内容相同', async () => {
    const adapter = CompressionFactory.create();
    const original = new TextEncoder().encode('same content, different format wrappers');
    const zlibData = new Uint8Array(deflateSync(original));
    const rawData = new Uint8Array(deflateRawSync(original));

    const fromZlib = await adapter.decompress(zlibData);
    const fromRaw = await adapter.decompress(rawData);
    expect(fromZlib).toEqual(original);
    expect(fromRaw).toEqual(original);
    expect(fromZlib).toEqual(fromRaw);
  });

  it('zlib 格式的 FCHECK 校验字节验证', async () => {
    const adapter = CompressionFactory.create();
    const data = new TextEncoder().encode('fcheck validation');
    const zlibData = new Uint8Array(deflateSync(data));
    // 验证 zlib 头的 FCHECK: (CMF * 256 + FLG) % 31 == 0
    const cmf = zlibData[0]!;
    const flg = zlibData[1]!;
    expect((cmf * 256 + flg) % 31).toBe(0);
    const decompressed = await adapter.decompress(zlibData);
    expect(decompressed).toEqual(data);
  });
});
