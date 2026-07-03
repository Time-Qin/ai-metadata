import type { AIGCMetadata } from './Metadata';
import { METADATA_FIELDS } from './Metadata';
import { MetadataError } from '@/errors/MetadataError';

/**
 * Metadata 校验器
 */
export class MetadataValidator {
  /**
   * 校验 metadata 是否合法
   * 检查 7 个字段全在、均为 string
   */
  static validate(metadata: unknown): metadata is AIGCMetadata {
    if (typeof metadata !== 'object' || metadata === null) {
      return false;
    }

    const obj = metadata as Record<string, unknown>;

    for (const field of METADATA_FIELDS) {
      if (!(field in obj)) {
        return false;
      }
      if (typeof obj[field] !== 'string') {
        return false;
      }
    }

    return true;
  }

  /**
   * 校验并抛出异常
   */
  static assertValid(metadata: unknown): asserts metadata is AIGCMetadata {
    if (typeof metadata !== 'object' || metadata === null) {
      throw new MetadataError('META_001', 'Metadata must be an object');
    }

    const obj = metadata as Record<string, unknown>;

    for (const field of METADATA_FIELDS) {
      if (!(field in obj)) {
        throw new MetadataError('META_002', `Missing field: ${field}`);
      }
      if (typeof obj[field] !== 'string') {
        throw new MetadataError('META_003', `Field ${field} must be string, got ${typeof obj[field]}`);
      }
    }
  }
}
