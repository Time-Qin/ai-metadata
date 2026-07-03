import { SDKError } from './SDKError';

/**
 * 压缩/解压错误
 * COMP_001: CompressionStream not supported
 * COMP_002: compress/decompress failed
 */
export class CompressionError extends SDKError {
  constructor(code: string, message: string, cause?: unknown) {
    super(code, message, cause);
    this.name = 'CompressionError';
  }
}
