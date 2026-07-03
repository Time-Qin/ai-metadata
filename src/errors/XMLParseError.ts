import { SDKError } from './SDKError';

/**
 * XML 解析错误
 * XML_001: parse failed
 */
export class XMLParseError extends SDKError {
  constructor(code: string, message: string, cause?: unknown) {
    super(code, message, cause);
    this.name = 'XMLParseError';
  }
}
