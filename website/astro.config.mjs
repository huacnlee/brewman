import { defineConfig } from 'astro/config';
export default defineConfig({
  site: process.env.SITE_URL || 'https://huacnlee.github.io',
  base: process.env.BASE_PATH || '/brewman',
  trailingSlash: 'always',
  devToolbar: { enabled: false },
  // The hero runs the app's night scene from ../src/ui/scene.ts.
  vite: { server: { fs: { allow: ['..'] } } },
});
