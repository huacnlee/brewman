# Brewman design — “Night Watch”

Brewman is a macOS desktop utility for the packages Homebrew installed. Design source: the Claude Design canvas
“Brewman 深色界面重设计” (main window, ui sheet, states, app icon).

## Visual language

- **A night city behind glass.** The window is a live `Shader` backdrop (`src/ui/NightScene.tsx`, its WGSL in
  `src/ui/scene.ts`, which the website's hero also runs with WebGPU): a cold backlight
  behind a hooded, caped figure on a rooftop, a hazy far skyline and a nearer one with gold windows, and a flock of
  bats leaving the light along three curved streams, each bat with its own speed, size, sideways drift and wing beat.
  It is drawn in a 1120×720 frame anchored to the window's right edge, and darkened on the left so the sidebar and
  the table stay readable. All panels are transparent (`bg-background/30–40`) and divided by `foreground/10`
  hairlines, so the scene shows through everywhere. The figure and bats are original shapes: no character, emblem or
  logo of any franchise.
- **One accent: bat gold.** `primary` marks the update path and nothing else: the update count, the latest version of
  an outdated package, the upgrade block and its primary button, keyboard focus, the selected nav item's edge, the
  city's windows. Up-to-date packages stay neutral (a grey diamond and “最新”). `danger` is only for uninstalling;
  `success` only for a completed operation.
- **Sharp.** Every radius token is 0: controls, rows, panels, chips, dialogs are square-cornered; status marks are
  diamonds. Only the macOS window chrome keeps its system shape.
- **Type.** System UI for content. A display face (`display` in `src/ui/controls.tsx`: Avenir Next Condensed, bold,
  uppercase, wide tracking) for the wordmark, section titles and small labels. Versions, paths, taps and counts are
  `font-mono` with tabular figures.
- **Spacing.** 4 / 8 / 12 / 16 / 20 / 24. Sidebar 208 wide (184 compact), inspector 300 (248 compact), header 52,
  table header 32, rows 44, status bar 28, nav items 30.
- **App icon.** `assets/icon.svg` → `assets/icon.png` (1024): the watcher's two glowing gold eyes on a night square.
  The same eyes are the brand mark in the title bar and on the website.

## Layout

A custom title bar spans the window (the system bar is hidden): the window controls and the BREWMAN brand over the
sidebar column, then the section title and count, search with ⌘F and Update Homebrew (更新 Homebrew: `brew update`, then the outdated list) at the right; its empty space moves the
window. Below it: sidebar (软件库 navigation with counts, Homebrew footer) | the package table (header, virtualized
rows, status bar) and the inspector (identity, description, upgrade block or “已是最新版本”, fields, dependency chips,
卸载软件包… pinned at the bottom).
Below 980pt the sidebar and inspector narrow and the table drops its version column.

## ui layer (`src/ui/`)

`Button` (primary / default / ghost / danger / danger-solid; sm 28, md 32), `NavItem`, `SearchField`, `PackageRow`,
`StatusMark`, `Field`, `Chip`, `Icon`, `TitleBar`, motion tokens in `motion.ts`. Features compose these and never
write colours or radii. `Icon` draws [Lucide](https://lucide.dev) icons through `nsh-icon` (12 / 14 / 16 / 20pt, tinted
by a text token); only the brand's lens eyes (`src/ui/icons/eyes.svg`) are the app's own drawing.

## Motion inventory

| Change | Motion | Reduced motion |
|---|---|---|
| Backdrop | A rainy night: rain in three depth layers slants from the upper right to the lower left; a few bats cross on random paths, speeds and sizes, their number drifting from none to a small flock; distant lightning flickers in some 11s spans; the backlight breathes, the cape billows; the watcher, an armored figure standing on the roof facing out, wrapped to the roof in a cape the wind throws out to the left, its lens eyes glowing and blinking every ~5s; all in the shader | Shader paused (a still night) |
| Letter index pressed | The list scrolls to the first package under that letter (animated scroll) and selects it; the letter at the top of the list is lit gold as it scrolls | Jumps without animation |
| About opens / closes | Native dialog fade, focus on Close | No animation |
| Window loses / regains focus | Title bar contents fade to 50–55% opacity and back, 150ms ease-out | Instant |
| Hover on buttons, nav items, rows | Background wash in, `instant` (120ms) ease-out | Instant |
| Press on buttons | Scale 0.97 plus deeper fill, `fast` (180ms) soft settle | Fill only |
| Press on rows / nav items | Deeper wash, no scale (columns stay stable) | Same |
| Sidebar section changes | One selection fill with a gold edge slides between items on a near-critically damped spring | Snaps |
| Selected package changes | Inspector content rises 4pt and fades in, 160ms ease-out | Instant |
| Status bar message changes | Message rises 4pt and fades in once per change | Instant |
| Search field focus | Border turns amber, `instant` | Instant |
| Busy (refresh, upgrade, uninstall) | Status bar shows the watching eyes beside the label: they glow up and down and blink once per 2.4s cycle (`watchMs`); buttons dim to disabled | Eyes lit and still |
| Uninstall confirmation opens / closes | Native dialog fade, focus on 取消 | No animation |
| Counts, versions, recycled rows | No motion: they update in place to keep scan position | — |
| Context menu | Native system motion | Native |
