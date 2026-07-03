/**
 * 压缩适配器接口
 * 统一 compress/decompress，隐藏浏览器差异
 */
export interface CompressionAdapter {
  /** 压缩数据（raw deflate，非 gzip） */
  compress(data: Uint8Array): Promise<Uint8Array>;
  /** 解压数据 */
  decompress(data: Uint8Array): Promise<Uint8Array>;
}
