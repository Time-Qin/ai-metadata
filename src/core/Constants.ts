/**
 * SDK 全局常量
 */

/** OOXML custom.xml 的 fmtid，固定不可修改 */
export const FMTID = '{D5CDD505-2E9C-101B-9397-08002B2CF9AE}';

/** AIGC 属性名称 */
export const AIGC_PROPERTY_NAME = 'AIGC';

/** docProps/custom.xml 在 ZIP 中的路径 */
export const CUSTOM_XML_PATH = 'docProps/custom.xml';

/** [Content_Types].xml 在 ZIP 中的路径 */
export const CONTENT_TYPES_PATH = '[Content_Types].xml';

/** custom.xml 的 Content Type */
export const CUSTOM_XML_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.custom-properties+xml';

/** Content Types 的命名空间 */
export const CONTENT_TYPES_NS =
  'http://schemas.openxmlformats.org/package/2006/content-types';

/** Custom Properties 的命名空间 */
export const PROPERTIES_NS =
  'http://schemas.openxmlformats.org/officeDocument/2006/custom-properties';

/** docPropsVTypes 的命名空间 */
export const VT_NS =
  'http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes';

/** AIGCMetadata 接口字段名 → JSON Key 映射（国标要求首字母大写） */
export const METADATA_KEY_MAP = {
  label: 'Label',
  contentProducer: 'ContentProducer',
  produceId: 'ProduceID',
  reservedCode1: 'ReservedCode1',
  contentPropagator: 'ContentPropagator',
  propagateId: 'PropagateID',
  reservedCode2: 'ReservedCode2',
} as const;

/** JSON Key → AIGCMetadata 接口字段名 反向映射 */
export const METADATA_KEY_MAP_REVERSE: Record<string, string> = {
  Label: 'label',
  ContentProducer: 'contentProducer',
  ProduceID: 'produceId',
  ReservedCode1: 'reservedCode1',
  ContentPropagator: 'contentPropagator',
  PropagateID: 'propagateId',
  ReservedCode2: 'reservedCode2',
};

/** OOXML 文件类型标志文件 */
export const OOXML_MARKERS = {
  DOCX: 'word/document.xml',
  PPTX: 'ppt/presentation.xml',
  XLSX: 'xl/workbook.xml',
} as const;
