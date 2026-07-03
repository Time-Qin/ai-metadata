import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

/**
 * Vitest setup: polyfill DOMParser and XMLSerializer for test environment.
 * In production, these are provided by the browser natively.
 * happy-dom does not support XML parsing (treats everything as HTML),
 * so we use @xmldom/xmldom which provides proper XML DOM support.
 */
globalThis.DOMParser = DOMParser as unknown as typeof globalThis.DOMParser;
globalThis.XMLSerializer = XMLSerializer as unknown as typeof globalThis.XMLSerializer;
