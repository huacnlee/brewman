import { expect, open, test } from "nsh/test";

test("opens the package library in English and switches categories", async () => {
  const app = await open("./App.tsx", {locale: "en-US"});
  expect(app.texts()).toContain("LIBRARY");
  expect(app.texts()).toContain("All Packages");
  await app.press("Cask");
  // The title bar now names the section too: "Cask" in the sidebar and in the title.
  expect(app.texts().filter(t => t === "Cask").length).toBe(2);
});

test("shows Simplified Chinese for a Chinese locale", async () => {
  const app = await open("./App.tsx", {locale: "zh-CN"});
  expect(app.texts()).toContain("全部软件");
  expect(app.texts()).toContain("可更新");
  await app.waitFor("未找到 Homebrew，请检查 brew 安装路径。");
});

test("falls back to English for other locales", async () => {
  const app = await open("./App.tsx", {locale: "fr-FR"});
  expect(app.texts()).toContain("Local Homebrew");
});

test("category selection works with reduced motion", async () => {
  const app = await open("./App.tsx", {locale: "en-US", reducedMotion: true});
  await app.press("Cask >> nth=0");
  expect(app.texts().filter(t => t === "Cask").length).toBe(2);
});

test("reports a missing Homebrew in the status bar without an error prefix", async () => {
  const app = await open("./App.tsx", {locale: "en-US"});
  await app.waitFor("Homebrew was not found. Check where brew is installed.");
  expect(app.texts().some(t => t.startsWith("Error:"))).toBe(false);
});

test("upgrades the selected formula and cask and refreshes after a failure", async () => {
  const calls: string[][] = [];
  const inventory = {formulae: [{name: "alpha", full_name: "alpha", desc: "", tap: "homebrew/core", outdated: true, revision: 0, versions: {stable: "2"}, installed: [{version: "1"}]}],
    casks: [{token: "beta", full_token: "beta", desc: "", tap: "homebrew/cask", outdated: true, version: "2", installed: "1"}]};
  const app = await open("./App.tsx", {locale: "en-US", width: 1120, height: 720, modules: {process: {run: (_command: string, args: string[]) => {
    calls.push(args);
    if (args[0] === "info") return {code: 0, stdout: JSON.stringify(inventory), stderr: ""};
    if (args[0] === "upgrade" && args[1] === "--formula") return {code: 1, stdout: "", stderr: "upgrade failed"};
    return {code: 0, stdout: "", stderr: ""};
  }}}});
  await app.waitFor("alpha");
  await app.press("Updates");
  await app.press("Select alpha for upgrade");
  expect(app.texts()).toContain("Upgrade Selected (1)");
  await app.press("Select Visible");
  expect(app.texts()).toContain("Upgrade Selected (2)");
  await app.press("Clear Visible");
  expect(app.enabled("Upgrade Selected (0)")).toBe(false);
  await app.press("Select Visible");
  await app.press("Upgrade Selected (2)");
  await app.waitFor("beta");
  await app.waitUntil(() => calls.filter(args => args[0] === "info").length === 2);
  expect(calls.filter(args => args[0] === "upgrade")).toEqual([["upgrade", "--formula", "alpha"], ["upgrade", "--cask", "beta"]]);
  expect(app.texts()).toContain("alpha: upgrade failed");
});
