import { describe, it, expect } from 'vitest';
import { PDFTokenizer, TokenType } from '@/pdf/PDFTokenizer';
import { encodeUtf8 } from '@/utils/Encoding';

describe('PDFTokenizer', () => {
  it('解析数字', () => {
    const data = encodeUtf8('123 45.67 -89');
    const tokenizer = new PDFTokenizer(data);

    const t1 = tokenizer.nextToken();
    expect(t1.type).toBe(TokenType.Number);
    expect(t1.value).toBe(123);

    const t2 = tokenizer.nextToken();
    expect(t2.type).toBe(TokenType.Number);
    expect(t2.value).toBe(45.67);

    const t3 = tokenizer.nextToken();
    expect(t3.type).toBe(TokenType.Number);
    expect(t3.value).toBe(-89);
  });

  it('解析 Name', () => {
    const data = encodeUtf8('/Type /Info /AIGC /My#20Name');
    const tokenizer = new PDFTokenizer(data);

    expect(tokenizer.nextToken().value).toBe('Type');
    expect(tokenizer.nextToken().value).toBe('Info');
    expect(tokenizer.nextToken().value).toBe('AIGC');
    expect(tokenizer.nextToken().value).toBe('My Name');
  });

  it('解析字面字符串', () => {
    const data = encodeUtf8('(Hello World) (Escaped \\(paren\\)) (Line\\nBreak)');
    const tokenizer = new PDFTokenizer(data);

    expect(tokenizer.nextToken().value).toBe('Hello World');
    expect(tokenizer.nextToken().value).toBe('Escaped (paren)');
    expect(tokenizer.nextToken().value).toBe('Line\nBreak');
  });

  it('解析嵌套括号字符串', () => {
    const data = encodeUtf8('(Level 1 (Level 2))');
    const tokenizer = new PDFTokenizer(data);
    const token = tokenizer.nextToken();
    expect(token.type).toBe(TokenType.LiteralString);
    expect(token.value).toBe('Level 1 (Level 2)');
  });

  it('解析十六进制字符串', () => {
    const data = encodeUtf8('<48656C6C6F>');
    const tokenizer = new PDFTokenizer(data);
    const token = tokenizer.nextToken();
    expect(token.type).toBe(TokenType.HexString);
    expect(token.value).toBe('Hello');
  });

  it('解析字典开始和结束', () => {
    const data = encodeUtf8('<< /Key Value >>');
    const tokenizer = new PDFTokenizer(data);

    const t1 = tokenizer.nextToken();
    expect(t1.type).toBe(TokenType.DictBegin);

    const t2 = tokenizer.nextToken();
    expect(t2.type).toBe(TokenType.Name);
    expect(t2.value).toBe('Key');

    const t3 = tokenizer.nextToken();
    expect(t3.type).toBe(TokenType.Keyword);
    expect(t3.value).toBe('Value');

    const t4 = tokenizer.nextToken();
    expect(t4.type).toBe(TokenType.DictEnd);
  });

  it('解析数组', () => {
    const data = encodeUtf8('[1 2 3]');
    const tokenizer = new PDFTokenizer(data);

    expect(tokenizer.nextToken().type).toBe(TokenType.ArrayBegin);
    expect(tokenizer.nextToken().value).toBe(1);
    expect(tokenizer.nextToken().value).toBe(2);
    expect(tokenizer.nextToken().value).toBe(3);
    expect(tokenizer.nextToken().type).toBe(TokenType.ArrayEnd);
  });

  it('解析关键字 true false null', () => {
    const data = encodeUtf8('true false null');
    const tokenizer = new PDFTokenizer(data);

    expect(tokenizer.nextToken().value).toBe('true');
    expect(tokenizer.nextToken().value).toBe('false');
    expect(tokenizer.nextToken().value).toBe('null');
  });

  it('跳过注释', () => {
    const data = encodeUtf8('% This is a comment\n/Name');
    const tokenizer = new PDFTokenizer(data);

    const token = tokenizer.nextToken();
    expect(token.type).toBe(TokenType.Name);
    expect(token.value).toBe('Name');
  });

  it('解析间接引用 (5 0 R)', () => {
    const data = encodeUtf8('5 0 R');
    const tokenizer = new PDFTokenizer(data);

    // Should produce Number, Number, Keyword
    expect(tokenizer.nextToken().type).toBe(TokenType.Number);
    expect(tokenizer.nextToken().type).toBe(TokenType.Number);
    expect(tokenizer.nextToken().type).toBe(TokenType.Keyword);
  });

  it('peekToken 不消费', () => {
    const data = encodeUtf8('/Name');
    const tokenizer = new PDFTokenizer(data);

    const peeked = tokenizer.peekToken();
    expect(peeked.type).toBe(TokenType.Name);

    const actual = tokenizer.nextToken();
    expect(actual.type).toBe(TokenType.Name);
    expect(actual.value).toBe('Name');
  });

  it('readLine 读取行', () => {
    const data = encodeUtf8('first line\nsecond line');
    const tokenizer = new PDFTokenizer(data);

    expect(tokenizer.readLine()).toBe('first line');
    expect(tokenizer.readLine()).toBe('second line');
  });

  it('EOF 返回 EOF token', () => {
    const data = encodeUtf8('42');
    const tokenizer = new PDFTokenizer(data);

    tokenizer.nextToken(); // consume 42
    const token = tokenizer.nextToken();
    expect(token.type).toBe(TokenType.EOF);
  });
});
