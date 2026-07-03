/**
 * 字符串工具：XML 转义、PDF 字符串转义
 */

/**
 * XML 转义
 * 注意：必须先转 & 再转其他字符
 */
export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * XML 反转义
 */
export function unescapeXml(str: string): string {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

/**
 * PDF Literal String 转义
 * 转义字符: ( ) \
 */
export function escapePdfString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/**
 * 将字节数组转为 PDF Hex String 内容（不含尖括号）
 */
export function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i]!.toString(16).padStart(2, '0').toUpperCase();
  }
  return hex;
}
