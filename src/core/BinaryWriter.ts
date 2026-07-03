/**
 * 二进制写入器
 * 使用 chunks 累积，避免预分配大小
 * 默认使用 Little Endian（ZIP 标准）
 */
export class BinaryWriter {
  private chunks: Uint8Array[] = [];
  private _size = 0;

  writeUint8(value: number): void {
    this.chunks.push(new Uint8Array([value & 0xff]));
    this._size += 1;
  }

  writeUint16(value: number, littleEndian = true): void {
    const arr = new Uint8Array(2);
    if (littleEndian) {
      arr[0] = value & 0xff;
      arr[1] = (value >> 8) & 0xff;
    } else {
      arr[0] = (value >> 8) & 0xff;
      arr[1] = value & 0xff;
    }
    this.chunks.push(arr);
    this._size += 2;
  }

  writeUint32(value: number, littleEndian = true): void {
    const arr = new Uint8Array(4);
    if (littleEndian) {
      arr[0] = value & 0xff;
      arr[1] = (value >> 8) & 0xff;
      arr[2] = (value >> 16) & 0xff;
      arr[3] = (value >>> 24) & 0xff;
    } else {
      arr[0] = (value >>> 24) & 0xff;
      arr[1] = (value >> 16) & 0xff;
      arr[2] = (value >> 8) & 0xff;
      arr[3] = value & 0xff;
    }
    this.chunks.push(arr);
    this._size += 4;
  }

  writeBytes(bytes: Uint8Array): void {
    this.chunks.push(bytes);
    this._size += bytes.length;
  }

  /**
   * 写入 ASCII 字符串（每个字符一字节）
   */
  writeString(str: string): void {
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      bytes[i] = str.charCodeAt(i) & 0xff;
    }
    this.chunks.push(bytes);
    this._size += str.length;
  }

  get size(): number {
    return this._size;
  }

  toArrayBuffer(): ArrayBuffer {
    const result = new Uint8Array(this._size);
    let offset = 0;
    for (const chunk of this.chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result.buffer;
  }

  toUint8Array(): Uint8Array {
    return new Uint8Array(this.toArrayBuffer());
  }
}
