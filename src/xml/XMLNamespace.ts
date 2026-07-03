/**
 * OOXML XML 命名空间常量
 * 命名空间 URI 定义在 core/Constants.ts，此处重新导出以便 xml 模块内使用
 */

/** Custom Properties 根命名空间 */
export { PROPERTIES_NS } from '@/core/Constants';

/** docPropsVTypes 命名空间 */
export { VT_NS } from '@/core/Constants';

/** Content Types 命名空间 */
export { CONTENT_TYPES_NS } from '@/core/Constants';

/** vt:lpwstr 元素标签 */
export const VT_LPWSTR = 'vt:lpwstr';

/** property 元素标签 */
export const PROPERTY_TAG = 'property';

/** Properties 根元素标签 */
export const PROPERTIES_TAG = 'Properties';

/** Override 元素标签（Content_Types.xml 中用） */
export const OVERRIDE_TAG = 'Override';
