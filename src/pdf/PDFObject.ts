/**
 * PDF 对象类型定义
 */

/** PDF 值的类型标签 */
export type PDFValueType =
  | 'null'
  | 'boolean'
  | 'number'
  | 'string'
  | 'name'
  | 'ref'
  | 'dict'
  | 'array';

/** PDF null */
export interface PDFNull {
  type: 'null';
}

/** PDF boolean */
export interface PDFBoolean {
  type: 'boolean';
  value: boolean;
}

/** PDF number (integer or real) */
export interface PDFNumber {
  type: 'number';
  value: number;
}

/** PDF string (literal or hex) */
export interface PDFString {
  type: 'string';
  value: string;
}

/** PDF name (e.g., /Type, /Info) */
export interface PDFName {
  type: 'name';
  value: string;
}

/** PDF indirect reference (e.g., 5 0 R) */
export interface PDFReference {
  type: 'ref';
  objNum: number;
  genNum: number;
}

/** PDF dictionary (<< /Key Value ... >>) */
export interface PDFDictionary {
  type: 'dict';
  entries: Map<string, PDFValue>;
}

/** PDF array ([ ... ]) */
export interface PDFArray {
  type: 'array';
  items: PDFValue[];
}

/** PDF 值的联合类型 */
export type PDFValue =
  | PDFNull
  | PDFBoolean
  | PDFNumber
  | PDFString
  | PDFName
  | PDFReference
  | PDFDictionary
  | PDFArray;

/** PDF 间接对象 (N M obj ... endobj) */
export interface PDFIndirectObject {
  objNum: number;
  genNum: number;
  value: PDFValue;
  offset: number;
}

/** 工厂函数 */
export const PDFObjects = {
  null: (): PDFNull => ({ type: 'null' }),
  bool: (value: boolean): PDFBoolean => ({ type: 'boolean', value }),
  num: (value: number): PDFNumber => ({ type: 'number', value }),
  str: (value: string): PDFString => ({ type: 'string', value }),
  name: (value: string): PDFName => ({ type: 'name', value }),
  ref: (objNum: number, genNum: number): PDFReference => ({ type: 'ref', objNum, genNum }),
  dict: (entries?: Map<string, PDFValue>): PDFDictionary => ({
    type: 'dict',
    entries: entries ?? new Map(),
  }),
  array: (items?: PDFValue[]): PDFArray => ({
    type: 'array',
    items: items ?? [],
  }),
};
