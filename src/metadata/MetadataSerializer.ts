import type { AIGCMetadata } from './Metadata';
import { METADATA_KEY_MAP, METADATA_KEY_MAP_REVERSE } from '@/core/Constants';
import { METADATA_FIELDS, createEmptyMetadata } from './Metadata';

/**
 * Metadata 序列化/反序列化
 *
 * 关键：JSON Key 必须使用国标格式（首字母大写）：
 * Label, ContentProducer, ProduceID, ReservedCode1,
 * ContentPropagator, PropagateID, ReservedCode2
 *
 * 注意：ProduceID 和 PropagateID 的 "ID" 全大写
 */
export class MetadataSerializer {
  /**
   * 将 AIGCMetadata 序列化为 JSON 字符串（国标 Key 格式）
   */
  static serialize(metadata: AIGCMetadata): string {
    const obj: Record<string, string> = {};
    for (const field of METADATA_FIELDS) {
      const jsonKey = METADATA_KEY_MAP[field];
      obj[jsonKey] = metadata[field] ?? '';
    }
    return JSON.stringify(obj);
  }

  /**
   * 将 JSON 字符串反序列化为 AIGCMetadata
   * 容忍缺失字段（补空串）
   */
  static deserialize(json: string): AIGCMetadata {
    const obj = JSON.parse(json) as Record<string, unknown>;
    const metadata = createEmptyMetadata();

    for (const [jsonKey, value] of Object.entries(obj)) {
      const fieldName = METADATA_KEY_MAP_REVERSE[jsonKey];
      if (fieldName && typeof value === 'string') {
        (metadata as unknown as Record<string, string>)[fieldName] = value;
      }
    }

    return metadata;
  }

  /**
   * 将 AIGCMetadata 序列化为 UTF-8 字节
   */
  static serializeToBytes(metadata: AIGCMetadata): Uint8Array {
    return new TextEncoder().encode(this.serialize(metadata));
  }
}
