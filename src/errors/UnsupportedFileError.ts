import { SDKError } from './SDKError';

/**
 * 不支持的文件格式错误
 * UNSUPPORTED_001: unsupported file type
 */
export class UnsupportedFileError extends SDKError {
  constructor(code: string, message: string, cause?: unknown) {
    super(code, message, cause);
    this.name = 'UnsupportedFileError';
  }
}
