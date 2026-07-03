import { SDKError } from './SDKError';

/**
 * 元数据错误
 * META_001: invalid metadata
 * META_002: missing field
 * META_003: type error
 */
export class MetadataError extends SDKError {
  constructor(code: string, message: string, cause?: unknown) {
    super(code, message, cause);
    this.name = 'MetadataError';
  }
}
