// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export default defineConfig({
  site: 'https://juliyooni.github.io',
  integrations: [sitemap()],
  i18n: {
    locales: ['en', 'ko'],
    defaultLocale: 'en',
    routing: {
      prefixDefaultLocale: false,
    },
  },
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
    shikiConfig: {
      theme: 'vitesse-light',
    },
  },
  vite: {
    // @magenta/music drags in old CommonJS deps (typedarray-pool 등) that
    // expect Node's `global` — alias it to `globalThis` in the browser.
    define: {
      global: 'globalThis',
    },
    // Magenta's ESM build does `import * as ndarray` then calls it as a
    // function; esbuild pre-bundling resolves the CJS interop correctly.
    optimizeDeps: {
      include: ['ndarray', 'ndarray-resample', 'fft.js'],
    },
    build: {
      commonjsOptions: {
        transformMixedEsModules: true,
      },
      chunkSizeWarningLimit: 2200,
    },
  },
});
