import { describe, it, expect } from 'vitest';
import { MetadataSerializer } from '@/metadata/MetadataSerializer';
import { MetadataValidator } from '@/metadata/MetadataValidator';
import { createEmptyMetadata, type AIGCMetadata } from '@/metadata/Metadata';

describe('MetadataSerializer', () => {
  const sampleMetadata: AIGCMetadata = {
    label: 'AI',
    contentProducer: 'ChatGPT',
    produceId: '001',
    reservedCode1: '',
    contentPropagator: 'web',
    propagateId: '002',
    reservedCode2: '',
  };

  it('serialize 应使用国标 Key（首字母大写）', () => {
    const json = MetadataSerializer.serialize(sampleMetadata);
    const obj = JSON.parse(json);
    expect(obj.Label).toBe('AI');
    expect(obj.ContentProducer).toBe('ChatGPT');
    expect(obj.ProduceID).toBe('001');
    expect(obj.ReservedCode1).toBe('');
    expect(obj.ContentPropagator).toBe('web');
    expect(obj.PropagateID).toBe('002');
    expect(obj.ReservedCode2).toBe('');
  });

  it('ProduceID 和 PropagateID 的 ID 全大写', () => {
    const json = MetadataSerializer.serialize(sampleMetadata);
    const obj = JSON.parse(json);
    expect(obj).toHaveProperty('ProduceID');
    expect(obj).toHaveProperty('PropagateID');
    expect(obj).not.toHaveProperty('ProduceId');
    expect(obj).not.toHaveProperty('PropagateId');
  });

  it('deserialize round-trip', () => {
    const json = MetadataSerializer.serialize(sampleMetadata);
    const deserialized = MetadataSerializer.deserialize(json);
    expect(deserialized).toEqual(sampleMetadata);
  });

  it('deserialize 容忍缺失字段', () => {
    const json = '{"Label":"test"}';
    const result = MetadataSerializer.deserialize(json);
    expect(result.label).toBe('test');
    expect(result.contentProducer).toBe('');
  });

  it('serializeToBytes 返回 UTF-8 字节', () => {
    const bytes = MetadataSerializer.serializeToBytes(sampleMetadata);
    const text = new TextDecoder().decode(bytes);
    expect(text).toBe(MetadataSerializer.serialize(sampleMetadata));
  });
});

describe('MetadataValidator', () => {
  const validMetadata: AIGCMetadata = {
    label: 'AI',
    contentProducer: 'ChatGPT',
    produceId: '001',
    reservedCode1: '',
    contentPropagator: 'web',
    propagateId: '002',
    reservedCode2: '',
  };

  it('validate 合法对象返回 true', () => {
    expect(MetadataValidator.validate(validMetadata)).toBe(true);
  });

  it('validate null 返回 false', () => {
    expect(MetadataValidator.validate(null)).toBe(false);
  });

  it('validate 缺少字段返回 false', () => {
    const partial = { ...validMetadata, produceId: undefined } as unknown;
    expect(MetadataValidator.validate(partial)).toBe(false);
  });

  it('validate 字段类型错误返回 false', () => {
    const wrong = { ...validMetadata, label: 123 } as unknown;
    expect(MetadataValidator.validate(wrong)).toBe(false);
  });

  it('assertValid 合法对象不抛异常', () => {
    expect(() => MetadataValidator.assertValid(validMetadata)).not.toThrow();
  });

  it('assertValid 非法对象抛 MetadataError', () => {
    expect(() => MetadataValidator.assertValid(null)).toThrow();
    expect(() => MetadataValidator.assertValid({ label: 'x' })).toThrow();
  });

  it('createEmptyMetadata 所有字段为空串', () => {
    const empty = createEmptyMetadata();
    expect(empty.label).toBe('');
    expect(empty.contentProducer).toBe('');
    expect(empty.produceId).toBe('');
    expect(empty.reservedCode1).toBe('');
    expect(empty.contentPropagator).toBe('');
    expect(empty.propagateId).toBe('');
    expect(empty.reservedCode2).toBe('');
  });
});
