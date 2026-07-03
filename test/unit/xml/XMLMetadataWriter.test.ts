import { describe, it, expect } from 'vitest';
import { XMLUtils } from '@/xml/XMLUtils';
import { XMLMetadataWriter } from '@/xml/XMLMetadataWriter';
import { XMLMetadataReader } from '@/xml/XMLMetadataReader';
import { PROPERTIES_NS, VT_NS } from '@/xml/XMLNamespace';
import { FMTID } from '@/core/Constants';

describe('XMLMetadataWriter', () => {
  function createEmptyDoc(): Document {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="${PROPERTIES_NS}" xmlns:vt="${VT_NS}"></Properties>`;
    return XMLUtils.parse(xml);
  }

  it('setProperty 创建新 property', () => {
    const doc = createEmptyDoc();
    const writer = new XMLMetadataWriter(doc);
    writer.setProperty('AIGC', '{"Label":"AI"}', FMTID, 2);

    const reader = new XMLMetadataReader(doc);
    expect(reader.getProperty('AIGC')).toBe('{"Label":"AI"}');
  });

  it('setProperty 覆盖已存在的 property', () => {
    const doc = createEmptyDoc();
    const writer = new XMLMetadataWriter(doc);
    writer.setProperty('AIGC', '{"Label":"old"}', FMTID, 2);
    writer.setProperty('AIGC', '{"Label":"new"}', FMTID, 2);

    const reader = new XMLMetadataReader(doc);
    expect(reader.getProperty('AIGC')).toBe('{"Label":"new"}');
  });

  it('removeProperty 删除 property', () => {
    const doc = createEmptyDoc();
    const writer = new XMLMetadataWriter(doc);
    writer.setProperty('AIGC', '{"Label":"AI"}', FMTID, 2);
    expect(writer.hasProperty('AIGC')).toBe(true);

    writer.removeProperty('AIGC');
    expect(writer.hasProperty('AIGC')).toBe(false);
  });

  it('hasProperty 不存在返回 false', () => {
    const doc = createEmptyDoc();
    const writer = new XMLMetadataWriter(doc);
    expect(writer.hasProperty('AIGC')).toBe(false);
  });

  it('stringify 保留命名空间', () => {
    const doc = createEmptyDoc();
    const writer = new XMLMetadataWriter(doc);
    writer.setProperty('AIGC', '{"Label":"AI"}', FMTID, 2);
    const xml = XMLUtils.stringify(doc);
    expect(xml).toContain('xmlns:vt');
    expect(xml).toContain('vt:lpwstr');
  });

  it('stringify 包含 XML 声明', () => {
    const doc = createEmptyDoc();
    const xml = XMLUtils.stringify(doc);
    expect(xml).toContain('<?xml');
  });

  it('listProperties 列出所有 property', () => {
    const doc = createEmptyDoc();
    const writer = new XMLMetadataWriter(doc);
    writer.setProperty('AIGC', '{"Label":"AI"}', FMTID, 2);
    writer.setProperty('Other', 'value', FMTID, 3);

    const reader = new XMLMetadataReader(doc);
    const list = reader.listProperties();
    expect(list.length).toBe(2);
    expect(list.find((p) => p.name === 'AIGC')?.value).toBe('{"Label":"AI"}');
    expect(list.find((p) => p.name === 'Other')?.value).toBe('value');
  });
});
