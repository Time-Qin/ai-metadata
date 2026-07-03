import { nodeResolve } from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';

export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/aigc-metadata.mjs',
      format: 'esm',
      sourcemap: true,
    },
    {
      file: 'dist/aigc-metadata.cjs',
      format: 'cjs',
      sourcemap: true,
    },
  ],
  plugins: [
    nodeResolve(),
    typescript({
      tsconfig: './tsconfig.json',
      declaration: true,
      outDir: 'dist',
    }),
    terser(),
  ],
  external: [],
};
