# aigc-metadata

[中文](./README.zh-CN.md) | English

Browser-side SDK for reading and writing AIGC implicit metadata in OOXML (DOCX/PPTX/XLSX) and PDF files.

Compliant with the Chinese national standard for AIGC content labeling. All operations run entirely in the browser with zero server-side dependencies.

## Features

- Supports DOCX, PPTX, XLSX (OOXML) and PDF file formats
- Read, write, and remove AIGC metadata
- Automatic file type detection via magic numbers (no file extension needed)
- PDF incremental update mode to preserve existing signatures
- Zero runtime dependencies, pure browser implementation
- Full TypeScript support with type declarations
- ESM and CJS dual module format

## Installation

```bash
npm install aigc-metadata
```

## Quick Start

```typescript
import { AIGCSDK } from 'aigc-metadata';

const sdk = new AIGCSDK();

// Read a file as ArrayBuffer
const response = await fetch('/document.docx');
const buffer = await response.arrayBuffer();

// Write AIGC metadata
const newBuffer = await sdk.addMetadata(buffer, {
  label: 'AIGC',
  contentProducer: 'MyModel',
  produceId: 'gen-001',
  reservedCode1: '',
  contentPropagator: 'MyPlatform',
  propagateId: 'prop-001',
  reservedCode2: '',
});

// Read AIGC metadata
const metadata = await sdk.readMetadata(newBuffer);
console.log(metadata);

// Check if metadata exists
const has = await sdk.hasMetadata(newBuffer);
console.log(has); // true

// Remove AIGC metadata
const cleanBuffer = await sdk.removeMetadata(newBuffer);
```

## API

### `new AIGCSDK(options?)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `strictMode` | `boolean` | `false` | Enable strict metadata validation |
| `compressionLevel` | `number` | `6` | ZIP compression level (0-9) |
| `pdfIncrementalMode` | `boolean` | `true` | Use PDF incremental update to preserve signatures |

### `addMetadata(buffer, metadata): Promise<ArrayBuffer>`

Write AIGC metadata into a file buffer. Returns a new buffer with the metadata embedded.

### `readMetadata(buffer): Promise<AIGCMetadata | null>`

Read AIGC metadata from a file buffer. Returns `null` if no metadata is found.

### `removeMetadata(buffer): Promise<ArrayBuffer>`

Remove AIGC metadata from a file buffer. Returns a clean buffer.

### `hasMetadata(buffer): Promise<boolean>`

Check whether the file contains AIGC metadata.

### `validateMetadata(metadata): boolean`

Validate whether a metadata object contains all required fields.

## AIGCMetadata Interface

```typescript
interface AIGCMetadata {
  label: string;             // AIGC content label
  contentProducer: string;   // Content producer / model name
  produceId: string;         // Generation ID
  reservedCode1: string;     // Reserved code 1
  contentPropagator: string; // Content propagator / platform
  propagateId: string;       // Propagation ID
  reservedCode2: string;     // Reserved code 2
}
```

## Supported File Formats

| Format | Extension | Detection |
|--------|-----------|-----------|
| Word Document | `.docx` | Magic number + ZIP content analysis |
| PowerPoint | `.pptx` | Magic number + ZIP content analysis |
| Excel | `.xlsx` | Magic number + ZIP content analysis |
| PDF | `.pdf` | Magic number (`%PDF-`) |

## License

MIT
