import { SDKError } from './SDKError';

/**
 * ZIP 结构错误
 * ZIP_001: EOCD missing
 * ZIP_002: invalid central directory
 * ZIP_003: offset mismatch
 * ZIP_004: CRC mismatch
 * ZIP_005: ZIP64 not supported
 */
export class ZipError extends SDKError {
  constructor(code: string, message: string, cause?: unknown) {
    super(code, message, cause);
    this.name = 'ZipError';
  }
}
