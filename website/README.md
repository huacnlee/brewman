# Brewman website

Static Astro site using Bun and GitHub Pages. Fonts are bundled locally. English lives at `/brewman/`, Simplified Chinese at `/brewman/zh-CN/`.

```sh
cd website
bun install --frozen-lockfile
bun run dev
bun run build
bun x playwright install chromium
bun run test
```

The default base is `/brewman`. Set `BASE_PATH` and `SITE_URL` together for another host. The production browser tests deliberately verify the GitHub Pages path.

`.github/workflows/website.yml` builds and tests pull requests, then deploys `main` using GitHub Pages. Repository Settings → Pages → Source must be **GitHub Actions**. No custom domain or external hosting credentials are required.

`public/install.sh` is a symlink to the repository's `install.sh`, so the published installer always matches `main`. `public/favicon.svg` is a copy of `assets/icon.svg`. `public/screenshot.png` is a copy of `assets/screenshot.png`.

The site uses the app's "Night Watch" palette and is dark only: one bat-gold accent, square corners everywhere, Oswald for display type, Geist for body text and JetBrains Mono for code. The hero runs the app's own night scene: the same WGSL as its window backdrop (`../src/ui/scene.ts`), drawn with WebGPU by `src/lib/night.ts`. It pauses while off screen or in a hidden tab, draws one still frame under `prefers-reduced-motion`, and where WebGPU is missing a still CSS sky with the same backlight stays. The brand mark is the app's pair of watcher eyes. The scene is original artwork and must not depict any character, emblem or logo of a franchise; a test checks the pages name none.

In a fresh clone where `nsh` has not run yet, the build needs `.nsh/tsconfig.json` (the app's root `tsconfig.json` extends it). Run `nsh check` once at the repository root, or create it as `{}`; the website workflow does the latter.
