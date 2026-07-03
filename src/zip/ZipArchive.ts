import type { ZipEntry, EOCDRecord } from './ZipEntry';

/**
 * ZIP 归档
 */
export class ZipArchive {
  constructor(
    public entries: ZipEntry[],
    public eocd: EOCDRecord,
  ) {}

  /**
   * 按文件名查找 entry
   */
  find(fileName: string): ZipEntry | undefined {
    return this.entries.find((e) => e.fileName === fileName);
  }

  /**
   * 按文件名查找 entry 索引
   */
  indexOf(fileName: string): number {
    return this.entries.findIndex((e) => e.fileName === fileName);
  }

  /**
   * 判断是否包含指定文件
   */
  has(fileName: string): boolean {
    return this.find(fileName) !== undefined;
  }
}
