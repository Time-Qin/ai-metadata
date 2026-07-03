import type { CompressionAdapter } from './types';
import { CompressionError } from '@/errors/CompressionError';

/**
 * 检测浏览器是否支持 deflate-raw 格式
 * deflate-raw (RFC 1951) 是 ZIP method 8 使用的格式
 * deflate (RFC 1950) 包含 zlib 头和 Adler-32 校验，不适用于 ZIP
 */
function isDeflateRawSupported(): boolean {
  try {
    new CompressionStream('deflate-raw');
    return true;
  } catch {
    return false;
  }
}

/**
 * 检测数据是否为 zlib 格式 (RFC 1950)
 * zlib 格式以 2 字节头开始:
 *   - CMF: 低 4 位 = CM (必须为 8 = deflate), 高 4 位 = CINFO (必须 ≤ 7)
 *   - FLG: (CMF * 256 + FLG) % 31 == 0 (FCHECK 校验)
 * PDF /FlateDecode 使用 zlib 格式，ZIP method 8 使用 raw DEFLATE
 */
function isZlibFormat(data: Uint8Array): boolean {
  if (data.length < 2) return false;
  const cmf = data[0]!;
  const flg = data[1]!;
  // CM 必须为 8 (deflate), CINFO 必须 ≤ 7
  if ((cmf & 0x0f) !== 0x08 || (cmf >> 4) > 7) return false;
  // FCHECK: (CMF * 256 + FLG) % 31 == 0
  if ((cmf * 256 + flg) % 31 !== 0) return false;
  return true;
}

/**
 * 从 ReadableStream 中收集所有 chunk
 * 替代 new Response(stream).arrayBuffer()，提供更精确的错误信息
 */
async function collectStream(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalLength += value.length;
  }
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

/**
 * 从 ReadableStream 中收集所有 chunk（容错模式）
 * 当流在末尾出错时（如 Adler-32 校验失败），仍然返回已收到的数据
 */
async function collectStreamLenient(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      totalLength += value.length;
    }
  } catch {
    // 流可能在末尾因缺少 Adler-32 校验而出错
    // 但解压数据在出错前已全部输出
    if (chunks.length === 0) {
      throw new CompressionError('COMP_002', 'Decompression failed: stream error with no output');
    }
  }
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

/**
 * 浏览器原生压缩实现
 * 使用 CompressionStream/DecompressionStream
 *
 * 压缩: 始终输出 raw DEFLATE (RFC 1951)，符合 ZIP method 8 要求
 * 解压: 自动检测输入格式 — zlib (RFC 1950, PDF /FlateDecode) 或 raw DEFLATE (RFC 1951, ZIP)
 */
export class BrowserCompression implements CompressionAdapter {
  private readonly useRaw: boolean;

  constructor() {
    this.useRaw = isDeflateRawSupported();
  }

  async compress(data: Uint8Array): Promise<Uint8Array> {
    if (this.useRaw) {
      return this.compressRaw(data);
    }
    return this.compressZlibAndStrip(data);
  }

  async decompress(data: Uint8Array): Promise<Uint8Array> {
    const zlib = isZlibFormat(data);
    if (this.useRaw) {
      return zlib ? this.decompressZlib(data) : this.decompressRaw(data);
    }
    return zlib ? this.decompressZlib(data) : this.decompressRawViaZlib(data);
  }

  /**
   * 使用 deflate-raw 直接压缩（优先路径）
   */
  private async compressRaw(data: Uint8Array): Promise<Uint8Array> {
    const cs = new CompressionStream('deflate-raw');
    const readable = new ReadableStream({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      },
    });
    return collectStream(readable.pipeThrough(cs));
  }

  /**
   * 使用 deflate-raw 直接解压（优先路径）
   */
  private async decompressRaw(data: Uint8Array): Promise<Uint8Array> {
    const ds = new DecompressionStream('deflate-raw');
    const readable = new ReadableStream({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      },
    });
    return collectStream(readable.pipeThrough(ds));
  }

  /**
   * 使用 deflate (zlib) 解压
   * 用于 PDF /FlateDecode 数据 (RFC 1950)
   */
  private async decompressZlib(data: Uint8Array): Promise<Uint8Array> {
    const ds = new DecompressionStream('deflate');
    const readable = new ReadableStream({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      },
    });
    return collectStream(readable.pipeThrough(ds));
  }

  /**
   * zlib 格式: [2-byte header][raw deflate][4-byte Adler-32]
   */
  private async compressZlibAndStrip(data: Uint8Array): Promise<Uint8Array> {
    const cs = new CompressionStream('deflate');
    const readable = new ReadableStream({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      },
    });
    const zlibData = await collectStream(readable.pipeThrough(cs));
    // 剥离 zlib 头 (2 bytes) 和 Adler-32 尾 (4 bytes)
    return zlibData.slice(2, zlibData.length - 4);
  }

  /**
   * 回退方案：为 raw deflate 数据添加 zlib 头，用 deflate 格式解压
   * 由于无法预知 Adler-32 校验值，使用容错模式收集数据
   */
  private async decompressRawViaZlib(data: Uint8Array): Promise<Uint8Array> {
    const ds = new DecompressionStream('deflate');
    // 0x78 0x01 = zlib header (CM=8, CINFO=7, FLEVEL=0)
    const zlibHeader = new Uint8Array([0x78, 0x01]);
    const readable = new ReadableStream({
      start(controller) {
        controller.enqueue(zlibHeader);
        controller.enqueue(data);
        controller.close();
      },
    });
    return collectStreamLenient(readable.pipeThrough(ds));
  }
}

/**
 * Fallback 压缩实现
 * 浏览器不支持 CompressionStream 时使用
 */
export class FallbackCompression implements CompressionAdapter {
  async compress(_data: Uint8Array): Promise<Uint8Array> {
    throw new CompressionError('COMP_001', 'CompressionStream not supported in this environment');
  }
  async decompress(_data: Uint8Array): Promise<Uint8Array> {
    throw new CompressionError('COMP_001', 'DecompressionStream not supported in this environment');
  }
}
