import { defineConfig } from 'tsup';

export default defineConfig([
  // Library build
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    minify: false,
    splitting: false,
    treeshake: true,
    target: 'node18',
  },
  // CLI build
  {
    entry: ['src/cli.ts'],
    format: ['esm'],
    dts: true,
    sourcemap: true,
    minify: false,
    splitting: false,
    treeshake: true,
    target: 'node18',
    banner: {
      js: '#!/usr/bin/env node'
    }
  }
]);