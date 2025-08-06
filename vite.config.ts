import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      include: ['src/**/*'],
      exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
      outputDir: 'dist/types',
    }),
  ],

  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'AgentJS',
      formats: ['es', 'cjs', 'umd'],
      fileName: format => {
        switch (format) {
          case 'es':
            return 'index.es.js';
          case 'cjs':
            return 'index.cjs.js';
          case 'umd':
            return 'index.umd.js';
          default:
            return 'index.js';
        }
      },
    },

    rollupOptions: {
      // Externalize p5 and tensorflow as peer/optional dependencies
      external: ['p5', '@types/p5', '@tensorflow/tfjs'],
      output: {
        globals: {
          p5: 'p5',
          '@tensorflow/tfjs': 'tf',
        },
      },
    },

    sourcemap: true,
    minify: 'esbuild',
    target: 'es2020',
  },

  resolve: {
    alias: {
      '@core': resolve(__dirname, 'src/core'),
      '@viz': resolve(__dirname, 'src/visualization'),
      '@analysis': resolve(__dirname, 'src/analysis'),
      '@utils': resolve(__dirname, 'src/utils'),
    },
  },

  test: {
    globals: true,
    environment: 'jsdom',
  },

  optimizeDeps: {
    include: ['eventemitter3', 'uuid'],
  },
});
