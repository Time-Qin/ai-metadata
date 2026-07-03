import type { AIGCMetadata } from './Metadata';

/**
 * Metadata 编辑器统一接口
 * OOXML 和 PDF 各自实现此接口
 */
export interface MetadataEditor {
  /** 读取 AIGC 元数据，不存在返回 null */
  read(): Promise<AIGCMetadata | null>;

  /** 写入 AIGC 元数据 */
  write(data: AIGCMetadata): Promise<void>;

  /** 删除 AIGC 元数据 */
  remove(): Promise<void>;

  /** 判断是否存在 AIGC 元数据 */
  has(): Promise<boolean>;

  /** 获取更新后的文件 buffer */
  getResult(): ArrayBuffer;
}
