/**
 * PDF Incremental Writer
 *
 * 增量更新结构:
 * [Original PDF bytes]
 * [New/Modified Object(s)]
 * xref
 * N M
 * OOOOOOOOOO 00000 n
 * ...
 * trailer
 * << /Size N /Root X 0 R /Info Y 0 R /Prev Z >>
 * startxref
 * OFFSET
 * %%EOF
 */

import { InfoDictionary } from './InfoDictionary';
import { XrefEntry } from './XrefParser';
import { TrailerInfo } from './TrailerParser';
import { concat } from '@/utils/BufferUtil';
import { encodeUtf8 } from '@/utils/Encoding';

/** 新对象的写入信息 */
export interface WrittenObject {
  objNum: number;
  genNum: number;
  offset: number;
  data: Uint8Array;
}

/**
 * 增量更新写入器
 */
export class IncrementWriter {
  /**
   * 执行增量更新
   *
   * @param originalData 原始 PDF 字节
   * @param info 更新后的 InfoDictionary
   * @param trailer 原始 trailer 信息
   * @param xrefEntries 原 xref 条目（用于 /Size 计算）
   * @param infoObjNum Info 对象的对象号（新创建或现有）
   * @returns 更新后的完整 PDF 字节
   */
  static write(
    originalData: Uint8Array,
    info: InfoDictionary,
    trailer: TrailerInfo,
    xrefEntries: Map<number, XrefEntry>,
    infoObjNum: number,
  ): Uint8Array {
    // 1. 计算最大对象号
    let maxObjNum = 0;
    for (const objNum of xrefEntries.keys()) {
      if (objNum > maxObjNum) maxObjNum = objNum;
    }
    if (infoObjNum > maxObjNum) maxObjNum = infoObjNum;

    // 2. 新对象的 genNum（增量更新通常 genNum 不变，新对象为 0）
    const infoGenNum = 0;

    // 3. 序列化 Info 对象
    const infoObjStr = info.serialize(infoObjNum, infoGenNum);
    const infoObjBytes = encodeUtf8(infoObjStr);

    // 4. 新对象的偏移（追加在原始 PDF 末尾）
    const newObjOffset = originalData.length;

    // 5. 构建新 xref section（只包含新/修改的对象）
    const xrefEntriesList: WrittenObject[] = [{
      objNum: infoObjNum,
      genNum: infoGenNum,
      offset: newObjOffset,
      data: infoObjBytes,
    }];

    // 6. 构建 xref 表文本
    const xrefStartOffset = newObjOffset + infoObjBytes.length;
    const xrefText = this.buildXrefSection(xrefEntriesList, infoObjNum);

    // 7. 构建 trailer 文本
    const newSize = maxObjNum + 1;
    const trailerText = this.buildTrailer(
      newSize,
      trailer.root,
      infoObjNum,
      infoGenNum,
      trailer.xrefOffset,
    );

    // 8. 构建 startxref + %%EOF
    const startxrefText = `startxref\n${xrefStartOffset}\n%%EOF\n`;
    const startxrefBytes = encodeUtf8(startxrefText);

    // 9. 拼接所有部分
    const xrefBytes = encodeUtf8(xrefText);
    const trailerBytes = encodeUtf8(trailerText);

    return concat(
      originalData,
      infoObjBytes,
      xrefBytes,
      trailerBytes,
      startxrefBytes,
    );
  }

  /**
   * 构建 xref section 文本
   */
  private static buildXrefSection(
    objects: WrittenObject[],
    startObjNum: number,
  ): string {
    const lines: string[] = ['xref'];
    lines.push(`${startObjNum} ${objects.length}`);

    for (const obj of objects) {
      // 格式: OOOOOOOOOO GGGGG n (20 字节固定宽度)
      const offsetStr = String(obj.offset).padStart(10, '0');
      const genStr = String(obj.genNum).padStart(5, '0');
      lines.push(`${offsetStr} ${genStr} n `);
    }

    return lines.join('\n') + '\n';
  }

  /**
   * 构建 trailer 文本
   */
  private static buildTrailer(
    size: number,
    root: { objNum: number; genNum: number } | null,
    infoObjNum: number,
    infoGenNum: number,
    prevXrefOffset: number,
  ): string {
    const lines: string[] = ['trailer', '<<'];

    lines.push(`  /Size ${size}`);

    if (root) {
      lines.push(`  /Root ${root.objNum} ${root.genNum} R`);
    }

    lines.push(`  /Info ${infoObjNum} ${infoGenNum} R`);
    lines.push(`  /Prev ${prevXrefOffset}`);

    lines.push('>>');
    return lines.join('\n') + '\n';
  }

  /**
   * 确定新对象号
   * 如果已有 Info 对象，复用其对象号；否则使用 max+1
   */
  static determineNewObjNum(
    existingInfoObjNum: number | null,
    xrefEntries: Map<number, XrefEntry>,
  ): number {
    if (existingInfoObjNum !== null && existingInfoObjNum >= 0) {
      return existingInfoObjNum;
    }

    let maxObjNum = 0;
    for (const objNum of xrefEntries.keys()) {
      if (objNum > maxObjNum) maxObjNum = objNum;
    }
    return maxObjNum + 1;
  }
}
