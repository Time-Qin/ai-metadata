import { SDKError } from './SDKError';

/**
 * PDF 解析/写入错误
 * PDF_001: invalid xref
 * PDF_002: trailer missing
 * PDF_003: object parse error
 * PDF_004: startxref not found
 * PDF_005: encrypted pdf not supported
 * PDF_006: xref stream not supported
 */
export class PDFError extends SDKError {
  constructor(code: string, message: string, cause?: unknown) {
    super(code, message, cause);
    this.name = 'PDFError';
  }
}
