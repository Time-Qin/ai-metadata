/**
 * 编码工具：UTF-8 / UTF-16BE 编解码
 * 浏览器原生 TextEncoder 仅支持 UTF-8，UTF-16BE 需手动实现
 */

const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder('utf-8');

export function encodeUtf8(str: string): Uint8Array {
  return utf8Encoder.encode(str);
}

export function decodeUtf8(bytes: Uint8Array): string {
  return utf8Decoder.decode(bytes);
}

/**
 * UTF-16BE 编码（PDF 字符串用，浏览器无原生支持）
 * 每个字符编码为 2 字节大端序
 */
export function encodeUtf16BE(str: string): Uint8Array {
  const bytes = new Uint8Array(str.length * 2);
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    bytes[i * 2] = (code >> 8) & 0xff;
    bytes[i * 2 + 1] = code & 0xff;
  }
  return bytes;
}

/**
 * UTF-16BE 解码
 */
export function decodeUtf16BE(bytes: Uint8Array): string {
  let result = '';
  for (let i = 0; i < bytes.length - 1; i += 2) {
    const code = (bytes[i]! << 8) | bytes[i + 1]!;
    result += String.fromCharCode(code);
  }
  return result;
}

/**
 * 将字符串编码为带 UTF-16BE BOM 的字节（PDF Hex String 用）
 * BOM: FE FF
 */
export function encodeUtf16BEWithBOM(str: string): Uint8Array {
  const encoded = encodeUtf16BE(str);
  const result = new Uint8Array(encoded.length + 2);
  result[0] = 0xfe;
  result[1] = 0xff;
  result.set(encoded, 2);
  return result;
}

/**
 * 解码带 BOM 的 UTF-16BE 字节
 */
export function decodeUtf16BEWithBOM(bytes: Uint8Array): string {
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return decodeUtf16BE(bytes.subarray(2));
  }
  return decodeUtf16BE(bytes);
}
