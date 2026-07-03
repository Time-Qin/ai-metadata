/**
 * Buffer 工具：拼接、比较、切片、子串搜索
 */

/**
 * 拼接多个 Uint8Array
 */
export function concat(...arrays: Uint8Array[]): Uint8Array {
  let totalLength = 0;
  for (const arr of arrays) {
    totalLength += arr.length;
  }
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/**
 * 比较两个 Uint8Array 是否相等
 */
export function equals(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * 从 buffer 中查找子串，返回起始偏移，找不到返回 -1
 * 用于 EOCD / %%EOF 扫描
 */
export function findBytes(buffer: Uint8Array, pattern: Uint8Array, fromOffset = 0): number {
  if (pattern.length === 0) return -1;
  const maxOffset = buffer.length - pattern.length;
  for (let i = fromOffset; i <= maxOffset; i++) {
    let match = true;
    for (let j = 0; j < pattern.length; j++) {
      if (buffer[i + j] !== pattern[j]) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return -1;
}

/**
 * 从后向前查找子串，返回起始偏移，找不到返回 -1
 */
export function findBytesReverse(buffer: Uint8Array, pattern: Uint8Array, fromOffset?: number): number {
  if (pattern.length === 0) return -1;
  const start = fromOffset ?? buffer.length - pattern.length;
  for (let i = start; i >= 0; i--) {
    let match = true;
    for (let j = 0; j < pattern.length; j++) {
      if (buffer[i + j] !== pattern[j]) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return -1;
}

/**
 * 将 Uint8Array 转为十六进制字符串（调试用）
 */
export function toHex(buffer: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < buffer.length; i++) {
    hex += buffer[i]!.toString(16).padStart(2, '0');
  }
  return hex;
}
