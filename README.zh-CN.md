# aigc-metadata

[English](./README.md) | 中文

浏览器端 AIGC 隐式元数据读写 SDK，支持 OOXML（DOCX/PPTX/XLSX）和 PDF 文件。

符合中国国家标准《生成式人工智能服务管理暂行办法》中关于 AIGC 内容标识的要求。所有操作完全在浏览器中运行，零服务端依赖。

## 功能特性

- 支持 DOCX、PPTX、XLSX（OOXML）和 PDF 文件格式
- 读取、写入、删除 AIGC 元数据
- 基于 Magic Number 自动检测文件类型，不依赖文件扩展名
- PDF 增量更新模式，保留已有数字签名
- 零运行时依赖，纯浏览器端实现
- 完整 TypeScript 类型支持
- 同时提供 ESM 和 CJS 模块格式

## 安装

```bash
npm install aigc-metadata
```

## 快速开始

```typescript
import { AIGCSDK } from 'aigc-metadata';

const sdk = new AIGCSDK();

// 读取文件为 ArrayBuffer
const response = await fetch('/document.docx');
const buffer = await response.arrayBuffer();

// 写入 AIGC 元数据
const newBuffer = await sdk.addMetadata(buffer, {
  label: 'AIGC',
  contentProducer: '内容生产模型名称',
  produceId: 'gen-001',
  reservedCode1: '',
  contentPropagator: '内容传播平台名称',
  propagateId: 'prop-001',
  reservedCode2: '',
});

// 读取 AIGC 元数据
const metadata = await sdk.readMetadata(newBuffer);
console.log(metadata);

// 检查是否包含元数据
const has = await sdk.hasMetadata(newBuffer);
console.log(has); // true

// 删除 AIGC 元数据
const cleanBuffer = await sdk.removeMetadata(newBuffer);
```

## API 参考

### `new AIGCSDK(options?)`

构造函数，接受可选配置：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `strictMode` | `boolean` | `false` | 开启严格模式，对非法元数据抛出异常 |
| `compressionLevel` | `number` | `6` | ZIP 压缩级别（0-9） |
| `pdfIncrementalMode` | `boolean` | `true` | PDF 使用增量更新模式，保留已有签名 |

### `addMetadata(buffer, metadata): Promise<ArrayBuffer>`

将 AIGC 元数据写入文件。返回包含元数据的新文件 buffer。

### `readMetadata(buffer): Promise<AIGCMetadata | null>`

从文件中读取 AIGC 元数据。若不存在元数据则返回 `null`。

### `removeMetadata(buffer): Promise<ArrayBuffer>`

从文件中删除 AIGC 元数据。返回清理后的文件 buffer。

### `hasMetadata(buffer): Promise<boolean>`

检查文件中是否包含 AIGC 元数据。

### `validateMetadata(metadata): boolean`

校验元数据对象是否包含所有必填字段。

## AIGCMetadata 接口

```typescript
interface AIGCMetadata {
  label: string;             // 标识类型
  contentProducer: string;   // 内容生产者 / 生成模型名称
  produceId: string;         // 生成 ID
  reservedCode1: string;     // 保留码 1
  contentPropagator: string; // 内容传播者 / 传播平台
  propagateId: string;       // 传播 ID
  reservedCode2: string;     // 保留码 2
}
```

## 支持的文件格式

| 格式 | 扩展名 | 检测方式 |
|------|--------|----------|
| Word 文档 | `.docx` | Magic Number + ZIP 内容分析 |
| PowerPoint | `.pptx` | Magic Number + ZIP 内容分析 |
| Excel | `.xlsx` | Magic Number + ZIP 内容分析 |
| PDF | `.pdf` | Magic Number（`%PDF-`） |

## 许可证

MIT
