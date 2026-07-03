/**
 * CRC32 实现（IEEE 802.3, Polynomial 0xEDB88320）
 * 用于 ZIP 文件校验
 *
 * 注意：输入必须是**未压缩**数据，ZIP 头里的 CRC 是原始数据的 CRC
 */
export class CRC32 {
  private static table: number[] | null = null;

  private static initTable(): number[] {
    const table: number[] = new Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
      }
      table[i] = c;
    }
    return table;
  }

  private static getTable(): number[] {
    if (this.table === null) {
      this.table = this.initTable();
    }
    return this.table;
  }

  /**
   * 计算数据的 CRC32 值
   * 返回 unsigned 32-bit 整数
   */
  static compute(data: Uint8Array): number {
    const table = CRC32.getTable();
    let crc = 0xffffffff;

    for (let i = 0; i < data.length; i++) {
      const idx = (crc ^ data[i]!) & 0xff;
      crc = (table[idx] ?? 0) ^ (crc >>> 8);
    }

    return (crc ^ 0xffffffff) >>> 0;
  }
}
