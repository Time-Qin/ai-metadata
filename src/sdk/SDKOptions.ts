/**
 * SDK 配置选项
 */
export interface SDKOptions {
  /** 严格模式：校验严格，不允许非法 metadata */
  strictMode?: boolean;

  /** 启用缓存 */
  enableCache?: boolean;

  /** 压缩级别 */
  compressionLevel?: number;

  /** PDF 增量更新模式（默认 true） */
  pdfIncrementalMode?: boolean;
}

/** 默认配置 */
export const DEFAULT_OPTIONS: SDKOptions = {
  strictMode: false,
  enableCache: false,
  compressionLevel: 6,
  pdfIncrementalMode: true,
};
