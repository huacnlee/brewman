# Brewman

A native macOS app for managing Homebrew packages, built with [NSH](https://nsh.dev). A dark “night watch” interface: a live
shader rainy night with bats behind translucent panels, sharp corners and a single gold accent.

<img alt="Brewman listing installed Homebrew packages, with a package's details in the inspector" src="assets/screenshot.png" />

[Website](https://huacnlee.github.io/brewman/) · [Download](https://github.com/huacnlee/brewman/releases) · [中文](https://huacnlee.github.io/brewman/zh-CN/)

- Lists every installed formula and cask, with the installed and latest versions side by side.
- Filters by All / Formula / Cask / Updates, and searches by name (⌘F).
- Inspector with description, tap, versions and dependencies.
- Upgrades a package, updates Homebrew (`brew update`, then refreshes the outdated list), and uninstalls after a confirmation.
- Right-click a row for Upgrade and Uninstall.
- English and Simplified Chinese, following the system language (English by default).
- Native AppKit views; the backdrop is a GPU shader that holds still when Reduce Motion is on.

## Install

macOS on Apple silicon or Intel, with [Homebrew](https://brew.sh) installed.

### Stable

```sh
curl -fsSL https://huacnlee.github.io/brewman/install.sh | sh
```

This downloads the latest release, verifies its SHA-256 checksum and installs `Brewman.app` into `~/Applications`. Run it
again to upgrade.

To install a specific release, pass `--version`:

```sh
curl -fsSL https://huacnlee.github.io/brewman/install.sh | sh -s -- --version v0.1.0
```

To install into another folder, pass `--dir`:

```sh
curl -fsSL https://huacnlee.github.io/brewman/install.sh | sh -s -- --dir /Applications
```

To remove it, quit Brewman and delete `~/Applications/Brewman.app`.

### From source

Install the `nsh` CLI from [nsh.dev](https://nsh.dev/docs/installation), then clone the repository and run Brewman:

```sh
git clone https://github.com/huacnlee/brewman.git
cd brewman
nsh run
```

To package `Brewman.app` for your Mac, run the release script with a version number. It writes
`.nsh/dist/brewman-v0.1.0-<arch>-apple-darwin.tar.gz`, which contains `Brewman.app`:

```sh
scripts/build-release.sh 0.1.0
```

## Development

Brewman is a TSX app on NSH (no Rust of its own). Install the `nsh` CLI from [nsh.dev](https://nsh.dev/docs/installation),
then use `nsh run` to run with hot reload, `nsh check` to type check, `nsh build` to bundle and `nsh test` to run the
headless UI tests:

```sh
nsh run
nsh check
nsh build
nsh test
```

- `App.tsx`: the window: title bar, sidebar, package table, inspector, uninstall dialog.
- `src/brew.ts`: runs `brew` and parses its JSON.
- `src/ui/`: the app's styled controls, icons, motion tokens, the title bar and the `NightScene` shader.
- `locales/`: UI text, `en.yml` and `zh-CN.yml` (read with `t()` from `nsh/i18n`).
- `theme.json`: color tokens. `DESIGN.md`: design rules and the motion inventory.
- `website/`: the [project website](https://huacnlee.github.io/brewman/), which also serves `install.sh`.

### Release

Push a `v*` tag. `.github/workflows/release.yml` packages `Brewman.app` on Apple silicon and Intel runners with
`scripts/build-release.sh`, then publishes the archives and `SHA256SUMS` as a GitHub Release. Locally:
`scripts/build-release.sh 0.1.0` writes `.nsh/dist/brewman-v0.1.0-<arch>-apple-darwin.tar.gz`.

## License

MIT. The bats, skyline, figure and app icon are original artwork.
