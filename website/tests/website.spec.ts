import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const installCommand = 'curl -fsSL https://huacnlee.github.io/brewman/install.sh | sh';
const installer = new URL('../../install.sh', import.meta.url);

test('English and Chinese routes keep correct links, language and metadata', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('./');
  await expect(page.locator('h1')).toHaveText('Keep watch over Homebrew.');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://huacnlee.github.io/brewman/');
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/brewman/favicon.svg');
  const favicon = await page.request.get('/brewman/favicon.svg');
  expect(favicon.ok()).toBe(true);
  expect(favicon.headers()['content-type']).toContain('image/svg+xml');
  await expect(page.getByRole('link', { name: 'Native Shell' })).toHaveAttribute('href', 'https://nsh.dev');
  await expect(page.getByRole('link', { name: 'GitHub', exact: true })).toHaveAttribute('href', 'https://github.com/huacnlee/brewman');
  for (const link of await page.getByRole('link', { name: 'GitHub Releases' }).all()) {
    await expect(link).toHaveAttribute('href', 'https://github.com/huacnlee/brewman/releases');
  }
  await expect(page.locator('.cta')).toHaveAttribute('href', 'https://github.com/huacnlee/brewman/releases');

  await page.locator('#language-toggle').click();
  await page.getByRole('menuitemradio', { name: '简体中文' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.locator('h1')).toHaveText('替你看好 Homebrew');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://huacnlee.github.io/brewman/zh-CN/');
  await expect(page.getByRole('link', { name: 'GitHub', exact: true })).toHaveAttribute('href', 'https://github.com/huacnlee/brewman');
  await expect(page.locator('#command-script')).toHaveText(installCommand);
  expect(errors).toEqual([]);
});

test('sitemap and robots point at the GitHub Pages path', async ({ page }) => {
  const sitemap = await (await page.request.get('/brewman/sitemap.xml')).text();
  expect(sitemap).toContain('<loc>https://huacnlee.github.io/brewman/</loc>');
  expect(sitemap).toContain('<loc>https://huacnlee.github.io/brewman/zh-CN/</loc>');
  const robots = await (await page.request.get('/brewman/robots.txt')).text();
  expect(robots).toContain('Sitemap: https://huacnlee.github.io/brewman/sitemap.xml');
});

test('published installer is the repository installer', async ({ page }) => {
  test.skip(!existsSync(installer), 'install.sh has not been added to the repository yet');
  const response = await page.request.get('/brewman/install.sh');
  expect(response.ok()).toBe(true);
  expect(await response.text()).toBe(readFileSync(installer, 'utf8'));
});

test('screenshot loads at its declared size', async ({ page }) => {
  await page.goto('./');
  const image = page.locator('.app-screenshot img');
  await image.scrollIntoViewIfNeeded();
  const declared = await image.evaluate((element: HTMLImageElement) => [Number(element.getAttribute('width')), Number(element.getAttribute('height'))]);
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => [element.naturalWidth, element.naturalHeight])).toEqual(declared);
});

test('the site is dark only, square-cornered and uses the bat gold accent', async ({ page }) => {
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('./');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(5, 6, 8)');
    await expect(page.locator('body')).toHaveCSS('color', 'rgb(236, 237, 240)');
  }
  await expect(page.locator('#theme-toggle')).toHaveCount(0);
  await expect(page.locator('.cta')).toHaveCSS('background-color', 'rgb(245, 197, 66)');
  for (const selector of ['.cta', '.command-block', '.copy-button', '.sponsor', '.app-screenshot img', 'nav .sponsor-button']) {
    await expect(page.locator(selector)).toHaveCSS('border-radius', '0px');
  }
  await expect(page.locator('h1')).toHaveCSS('font-family', /Oswald/);
  await expect(page.locator('h1')).toHaveCSS('text-transform', 'uppercase');
  await expect(page.locator('pre')).toHaveCSS('font-family', /JetBrains Mono/);
});

test('hero runs the night scene on a canvas and the brand shows the watcher eyes', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.night')).toHaveAttribute('role', 'img');
  await expect(page.locator('.night canvas')).toHaveCount(1);
  await expect(page.locator('.brand-mark')).toHaveAttribute('viewBox', '0 0 24 12');
  await expect(page.locator('.brand-mark')).toHaveCSS('color', 'rgb(245, 197, 66)');
});

test('copy names no franchise', async ({ page }) => {
  for (const route of ['./', './zh-CN/']) {
    await page.goto(route);
    const html = await page.content();
    expect(html).not.toMatch(/batman|gotham|\bDC\b|蝙蝠侠|哥谭/i);
  }
});

test('related projects link to the other projects in both languages', async ({ page }) => {
  for (const [route, name] of [['./', 'More projects'], ['./zh-CN/', '更多项目']]) {
    await page.goto(route);
    const related = page.getByRole('region', { name });
    await expect(related.getByRole('link', { name: 'Disktree' })).toHaveAttribute('href', 'https://huacnlee.github.io/disktree/');
    await expect(related.getByRole('link', { name: 'Omasend' })).toHaveAttribute('href', 'https://huacnlee.github.io/omasend/');
    await expect(related.getByRole('link', { name: 'Omamail' })).toHaveAttribute('href', 'https://huacnlee.github.io/omamail/');
    await expect(related.getByRole('link', { name: 'Noop' })).toHaveAttribute('href', 'https://huacnlee.github.io/noop/');
    await expect(related.getByRole('link', { name: 'huacnlee/cargo' })).toHaveAttribute('href', 'https://huacnlee.github.io/cargo/');
    await expect(related.getByRole('link', { name: 'omarchy-mihoro' })).toHaveAttribute('href', 'https://github.com/huacnlee/omarchy-mihoro');
    await expect(related.locator('li p')).toHaveCount(6);
  }
});

test('language menu handles keyboard selection, escape and outside click', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Language' }).focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitemradio', { name: 'English' })).toBeFocused();
  await expect(page.getByRole('menuitemradio', { name: 'English' })).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('End');
  await expect(page.getByRole('menuitemradio', { name: '简体中文' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Language' })).toBeFocused();
  await expect(page.getByRole('menu')).toHaveCount(0);
  await page.getByRole('button', { name: 'Language' }).click();
  await page.locator('h1').click();
  await expect(page.getByRole('menu')).toHaveCount(0);
});

test('copy button copies the install command', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  for (const [route, label, done] of [['./', 'Copy', 'Copied'], ['./zh-CN/', '复制', '已复制']]) {
    await page.goto(route);
    await page.evaluate(() => navigator.clipboard.writeText(''));
    await page.getByRole('button', { name: label, exact: true }).click();
    await expect(page.getByRole('status')).toHaveText(done);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(installCommand);
  }
});

for (const [width, height] of [[360, 640], [1440, 900]]) {
  test(`installation follows hero in first viewport at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    for (const route of ['./', './zh-CN/']) {
      await page.goto(route);
      expect(await page.locator('.hero').evaluate(element => element.nextElementSibling?.id)).toBe('install');
      const bounds = await page.locator('#command-script').boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(height);
    }
  });
}

for (const width of [360, 768, 1440]) {
  test(`layout fits ${width}px and reduced motion retains content`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const route of ['./', './zh-CN/']) {
      await page.goto(route);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await expect(page.locator('h1')).toBeVisible();
    }
  });
}

test('keyboard reaches skip link and section link', async ({ page }) => {
  await page.goto('./');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await expect(page.locator('.cta')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'See how it works' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#workflow$/);
});

test('Chinese headings have no trailing full stop', async ({ page }) => {
  await page.goto('./zh-CN/');
  for (const text of await page.locator('h1, h2, h3, .eyebrow').allTextContents()) {
    expect(text.trim()).not.toMatch(/。/);
  }
});

test('every page asks for sponsorship with a visible button', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  for (const [route, text, nav, button] of [['./', 'If this helps you, please sponsor me.', 'Sponsor me', 'Sponsor on GitHub'], ['./zh-CN/', '如果这个项目帮到了你，请赞助我。', '赞助作者', '在 GitHub 上赞助']]) {
    await page.goto(route);
    await expect(page.locator('.sponsor p')).toHaveText(text);
    await expect(page.locator('.sponsor .sponsor-button')).toHaveText(button);
    await expect(page.locator('nav .sponsor-button')).toHaveText(nav);
    await expect(page.locator('nav .sponsor-button')).toBeVisible();
    for (const link of await page.locator('.sponsor-button').all()) {
      await expect(link).toHaveAttribute('href', 'https://github.com/sponsors/huacnlee');
      await expect(link).toHaveAttribute('target', '_blank');
    }
  }
});

test('the sponsor card follows install and stays on phones', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('./');
  await expect(page.locator('#install + .sponsor')).toBeVisible();
  await expect(page.locator('nav .sponsor-button')).toBeHidden();
});
