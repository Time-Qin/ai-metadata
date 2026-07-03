/**
 * AIGC 元数据数据模型
 * 所有格式统一使用此接口
 *
 * JSON Key 必须保持与国家标准一致（首字母大写）：
 * Label, ContentProducer, ProduceID, ReservedCode1,
 * ContentPropagator, PropagateID, ReservedCode2
 */
export interface AIGCMetadata {
  /** 标识类型 */
  label: string;
  /** 生成模型/内容生产者 */
  contentProducer: string;
  /** 生成ID */
  produceId: string;
  /** 保留码1 */
  reservedCode1: string;
  /** 传播载体/内容传播者 */
  contentPropagator: string;
  /** 传播ID */
  propagateId: string;
  /** 保留码2 */
  reservedCode2: string;
}

/**
 * Metadata 接口字段名列表
 */
export const METADATA_FIELDS: readonly (keyof AIGCMetadata)[] = [
  'label',
  'contentProducer',
  'produceId',
  'reservedCode1',
  'contentPropagator',
  'propagateId',
  'reservedCode2',
] as const;

/**
 * 创建带默认空值的 Metadata
 */
export function createEmptyMetadata(): AIGCMetadata {
  return {
    label: '',
    contentProducer: '',
    produceId: '',
    reservedCode1: '',
    contentPropagator: '',
    propagateId: '',
    reservedCode2: '',
  };
}
