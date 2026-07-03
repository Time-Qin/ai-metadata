/**
 * 性能测试：压力测试和性能基准
 */

import { describe, it, expect } from 'vitest';
import { AIGCSDK } from '@/sdk/AIGCSDK';
import { encodeUtf8 } from '@/utils/Encoding';
import type { AIGCMetadata } from '@/metadata/Metadata';

function buildMinimalPDF(): ArrayBuffer {
  const header = '%PDF-1.4\n';
  let pos = header.length;
  const offsets: number[] = [0];

  const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  offsets.push(pos); pos += obj1.length;
  const obj2 = '2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n';
  offsets.push(pos); pos += obj2.length;
  const obj3 = '3 0 obj\n<<\n  /Producer (Test PDF)\n>>\nendobj\n';
  offsets.push(pos); pos += obj3.length;

  const xrefOffset = pos;
  const xrefLines = ['xref', `0 ${offsets.length}`];
  xrefLines.push('0000000000 65535 f ');
  for (let i = 1; i < offsets.length; i++) {
    xrefLines.push(`${String(offsets[i]!).padStart(10, '0')} 00000 n `);
  }
  const xref = xrefLines.join('\n') + '\n';
  const trailer = `trailer\n<< /Size ${offsets.length} /Root 1 0 R /Info 3 0 R >>\n`;
  const startxref = `startxref\n${xrefOffset}\n%%EOF\n`;

  const text = header + obj1 + obj2 + obj3 + xref + trailer + startxref;
  return encodeUtf8(text).buffer.slice(0, text.length) as ArrayBuffer;
}

const testMetadata: AIGCMetadata = {
  label: 'AI',
  contentProducer: 'GPT-4',
  produceId: 'ID-001',
  reservedCode1: '',
  contentPropagator: 'web',
  propagateId: 'ID-002',
  reservedCode2: '',
};

describe('性能测试', () => {
  it('PDF: 100 次连续写入无崩溃', async () => {
    const sdk = new AIGCSDK();
    let buffer = buildMinimalPDF();

    const startTime = Date.now();

    for (let i = 0; i < 100; i++) {
      buffer = await sdk.addMetadata(buffer, {
        ...testMetadata,
        label: `Iteration-${i}`,
      });
    }

    const elapsed = Date.now() - startTime;

    // 验证最终结果
    const read = await sdk.readMetadata(buffer);
    expect(read!.label).toBe('Iteration-99');

    // 100 次写入应该在合理时间内完成
    expect(elapsed).toBeLessThan(10000);
  });

  it('PDF: 多次写入后读取性能稳定', async () => {
    const sdk = new AIGCSDK();
    let buffer = buildMinimalPDF();

    // 写入 50 次
    for (let i = 0; i < 50; i++) {
      buffer = await sdk.addMetadata(buffer, { ...testMetadata, label: `I-${i}` });
    }

    // 读取 10 次测量时间
    const startTime = Date.now();
    for (let i = 0; i < 10; i++) {
      await sdk.readMetadata(buffer);
    }
    const elapsed = Date.now() - startTime;

    // 10 次读取应该在 1 秒内完成
    expect(elapsed).toBeLessThan(1000);
  });

  it('PDF: 单次写入+读取性能基准', async () => {
    const sdk = new AIGCSDK();
    const buffer = buildMinimalPDF();

    const writeStart = Date.now();
    const result = await sdk.addMetadata(buffer, testMetadata);
    const writeTime = Date.now() - writeStart;

    const readStart = Date.now();
    await sdk.readMetadata(result);
    const readTime = Date.now() - readStart;

    // 单次操作应该在 50ms 内完成
    expect(writeTime).toBeLessThan(50);
    expect(readTime).toBeLessThan(50);
  });

  it('PDF: hasMetadata 性能', async () => {
    const sdk = new AIGCSDK();
    const buffer = buildMinimalPDF();
    const withMeta = await sdk.addMetadata(buffer, testMetadata);

    const start = Date.now();
    for (let i = 0; i < 100; i++) {
      await sdk.hasMetadata(withMeta);
    }
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(2000);
  });

  it('validateMetadata 性能', () => {
    const sdk = new AIGCSDK();

    const start = Date.now();
    for (let i = 0; i < 10000; i++) {
      sdk.validateMetadata(testMetadata);
    }
    const elapsed = Date.now() - start;

    // 10000 次校验应该在 500ms 内完成
    expect(elapsed).toBeLessThan(500);
  });
});
