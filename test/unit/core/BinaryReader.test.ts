import { describe, it, expect } from 'vitest';
import { BinaryReader } from '@/core/BinaryReader.js';
import { BinaryWriter } from '@/core/BinaryWriter.js';

describe('BinaryReader', () => {
  it('读取 Little Endian uint16/32', () => {
    const writer = new BinaryWriter();
    writer.writeUint16(0x0102, true);
    writer.writeUint32(0x03040506, true);
    const buf = writer.toArrayBuffer();

    const reader = new BinaryReader(buf);
    expect(reader.readUint16(true)).toBe(0x0102);
    expect(reader.readUint32(true)).toBe(0x03040506);
  });

  it('读取 Big Endian uint16/32', () => {
    const writer = new BinaryWriter();
    writer.writeUint16(0x0102, false);
    writer.writeUint32(0x03040506, false);
    const buf = writer.toArrayBuffer();

    const reader = new BinaryReader(buf);
    expect(reader.readUint16(false)).toBe(0x0102);
    expect(reader.readUint32(false)).toBe(0x03040506);
  });

  it('seek/skip/tell', () => {
    const writer = new BinaryWriter();
    writer.writeUint8(0x01);
    writer.writeUint8(0x02);
    writer.writeUint8(0x03);
    const buf = writer.toArrayBuffer();

    const reader = new BinaryReader(buf);
    expect(reader.tell()).toBe(0);
    reader.seek(2);
    expect(reader.tell()).toBe(2);
    expect(reader.readUint8()).toBe(0x03);
    reader.seek(0);
    reader.skip(1);
    expect(reader.readUint8()).toBe(0x02);
  });

  it('readBytes 返回正确数据', () => {
    const writer = new BinaryWriter();
    writer.writeBytes(new Uint8Array([1, 2, 3, 4, 5]));
    const buf = writer.toArrayBuffer();

    const reader = new BinaryReader(buf);
    const bytes = reader.readBytes(3);
    expect(Array.from(bytes)).toEqual([1, 2, 3]);
  });

  it('remaining 计算正确', () => {
    const writer = new BinaryWriter();
    writer.writeUint32(1);
    const buf = writer.toArrayBuffer();

    const reader = new BinaryReader(buf);
    expect(reader.remaining()).toBe(4);
    reader.readUint16();
    expect(reader.remaining()).toBe(2);
  });

  it('peekUint32 不移动偏移', () => {
    const writer = new BinaryWriter();
    writer.writeUint32(0xDEADBEEF, true);
    const buf = writer.toArrayBuffer();

    const reader = new BinaryReader(buf);
    expect(reader.peekUint32(true)).toBe(0xDEADBEEF);
    expect(reader.tell()).toBe(0);
    reader.readUint32();
    expect(reader.tell()).toBe(4);
  });

  it('支持从 Uint8Array 构造', () => {
    const data = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
    const reader = new BinaryReader(data);
    expect(reader.readUint16(true)).toBe(0x0201);
    expect(reader.readUint16(true)).toBe(0x0403);
  });
});

describe('BinaryWriter', () => {
  it('writeString 写入 ASCII', () => {
    const writer = new BinaryWriter();
    writer.writeString('hello');
    const arr = new Uint8Array(writer.toArrayBuffer());
    expect(Array.from(arr)).toEqual([104, 101, 108, 108, 111]);
  });

  it('size 属性正确', () => {
    const writer = new BinaryWriter();
    writer.writeUint8(1);
    writer.writeUint16(2);
    writer.writeUint32(3);
    expect(writer.size).toBe(7);
  });

  it('toUint8Array 返回正确数据', () => {
    const writer = new BinaryWriter();
    writer.writeUint8(0x41);
    const arr = writer.toUint8Array();
    expect(arr.length).toBe(1);
    expect(arr[0]).toBe(0x41);
  });
});
