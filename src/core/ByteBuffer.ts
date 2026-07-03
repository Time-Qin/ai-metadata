/**
 * 动态拼接 Buffer
 * 仅拼接不写标量，与 BinaryWriter 职责区分
 */
export class ByteBuffer {
  private chunks: Uint8Array[] = [];
  private _size = 0;

  append(data: Uint8Array): void {
    this.chunks.push(data);
    this._size += data.length;
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
