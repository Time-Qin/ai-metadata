/**
 * SDK 错误基类
 * 所有 SDK 内部错误都继承此类，统一携带 code 字段
 */
export class SDKError extends Error {
  readonly code: string;
  readonly cause?: unknown;

  constructor(code: string, message: string, cause?: unknown) {
    super(message);
    this.name = 'SDKError';
    this.code = code;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }

  static isSDKError(e: unknown): e is SDKError {
    return e instanceof SDKError || (typeof e === 'object' && e !== null && 'code' in e && e instanceof Error);
  }
}
