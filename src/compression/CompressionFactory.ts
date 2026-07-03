import type { CompressionAdapter } from './types';
import { BrowserCompression, FallbackCompression } from './BrowserCompression';

/**
 * 压缩适配器工厂
 * 检测浏览器能力，选择最佳实现
 */
export class CompressionFactory {
  private static instance: CompressionAdapter | null = null;

  static create(): CompressionAdapter {
    if (this.instance) {
      return this.instance;
    }

    if (typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined') {
      this.instance = new BrowserCompression();
    } else {
      this.instance = new FallbackCompression();
    }

    return this.instance;
  }

  /**
   * 重置实例（测试用）
   */
  static reset(): void {
    this.instance = null;
  }
}
