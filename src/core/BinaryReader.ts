/**
 * 二进制读取器
 * 支持 ArrayBuffer 或 Uint8Array 输入
 * 默认使用 Little Endian（ZIP 标准）
 */
export class BinaryReader {
  private readonly view: DataView;
  private readonly _buffer: ArrayBuffer;
  private offset: number;
  readonly length: number;

  constructor(buffer: ArrayBuffer | Uint8Array) {
    if (buffer instanceof Uint8Array) {
      this._buffer = buffer.buffer as ArrayBuffer;
      this.offset = buffer.byteOffset;
      this.length = buffer.byteLength;
    } else {
      this._buffer = buffer;
      this.offset = 0;
      this.length = buffer.byteLength;
    }
    this.view = new DataView(this._buffer);
  }

  readUint8(): number {
    const v = this.view.getUint8(this.offset);
    this.offset += 1;
    return v;
  }

  readUint16(littleEndian = true): number {
    const v = this.view.getUint16(this.offset, littleEndian);
    this.offset += 2;
    return v;
  }

  readUint32(littleEndian = true): number {
    const v = this.view.getUint32(this.offset, littleEndian);
    this.offset += 4;
    return v;
  }

  /**
   * 读取指定长度的字节，返回 zero-copy 子视图
   * 注意：返回的视图指向原 buffer，不应被修改
   */
  readBytes(length: number): Uint8Array {
    const slice = new Uint8Array(this._buffer, this.offset, length);
    this.offset += length;
    return slice;
  }

  /**
   * 预读 4 字节，不移动偏移
   */
  peekUint32(littleEndian = true): number {
    return this.view.getUint32(this.offset, littleEndian);
  }

  /**
   * 预读 1 字节，不移动偏移
   */
  peekUint8(): number {
    return this.view.getUint8(this.offset);
  }

  seek(position: number): void {
    this.offset = position;
  }

  skip(length: number): void {
    this.offset += length;
  }

  tell(): number {
    return this.offset;
  }

  remaining(): number {
    return this.length - this.offset;
  }

  /**
   * 获取底层 buffer 引用（用于 readBytes 的 zero-copy 访问）
   */
  get buffer(): ArrayBuffer {
    return this._buffer;
  }
}
