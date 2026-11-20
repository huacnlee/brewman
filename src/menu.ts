// The application menu (macOS's menu bar). Its labels follow the app's language: it is set again in an effect.
import { effect, keymap } from "nsh";
import { Application, Menu } from "nsh/desktop";
import type { MenuEntry } from "./ui/menu";
import { t } from "nsh/i18n";
import { links, openExternal } from "./links";

export interface MenuActions {
  about(): void;
  background(): boolean;
  backgroundReady(): boolean;
  toggleBackground(): void;
  updateHomebrew(): void;
  find(): void;
  /** The sidebar sections, in order: chosen by ⌘1…⌘4. */
  sections(): {label: string; selected: boolean; select(): void}[];
  busy(): boolean;
}

/** The title bar Menu's rows: what the app does, about it, and quitting, at hand without the menu bar. */
export function toolbarMenuItems(a: MenuActions): MenuEntry[] {
  return [
    {label: t("quick_menu.update"), icon: "refresh", shortcut: keymap.label("mod+r"), disabled: a.busy(), select: a.updateHomebrew},
    {label: t(a.background() ? "background.hide" : "background.show"), disabled: !a.backgroundReady(), select: a.toggleBackground},
    {label: t("quick_menu.search"), icon: "search", shortcut: keymap.label("mod+f"), select: a.find},
    "separator",
    {label: t("quick_menu.about"), icon: "info", select: a.about},
    {label: t("quick_menu.website"), icon: "globe", select: () => openExternal(links.website)},
    {label: t("quick_menu.github"), icon: "branch", select: () => openExternal(links.repo)},
    {label: t("quick_menu.feedback"), icon: "message", select: () => openExternal(links.issues)},
    "separator",
    {label: t("quick_menu.sponsor"), icon: "heart", select: () => openExternal(links.sponsor)},
    "separator",
    {label: t("quick_menu.quit"), icon: "power", shortcut: keymap.label("mod+q"), select: () => Application.quit()},
  ];
}

export function installAppMenu(a: MenuActions): void {
  effect(() => Menu.setApplicationMenu([
    {label: "Brewman", submenu: [
      {label: t("app_menu.about"), onSelect: a.about},
      {type: "separator"},
      {label: t("app_menu.sponsor"), onSelect: () => openExternal(links.sponsor)},
      {type: "separator"},
      {role: "hide"}, {role: "hideOthers"}, {role: "showAll"},
      {type: "separator"},
      {role: "quit"},
    ]},
    {label: t("app_menu.file"), submenu: [
      {label: t("toolbar.update_homebrew"), shortcut: "mod+r", disabled: a.busy(), onSelect: a.updateHomebrew},
      {label: t("app_menu.find"), shortcut: "mod+f", onSelect: a.find},
      {type: "separator"},
      {role: "close"},
    ]},
    {label: t("app_menu.edit"), submenu: [
      {role: "undo"}, {role: "redo"}, {type: "separator"},
      {role: "cut"}, {role: "copy"}, {role: "paste"}, {role: "selectAll"},
    ]},
    {label: t("app_menu.view"), submenu: [
      ...a.sections().map((s, i) => ({label: s.label, shortcut: "mod+" + (i + 1), checked: s.selected, onSelect: s.select})),
      {type: "separator"},
      {label: t("background.menu"), checked: a.background(), disabled: !a.backgroundReady(), onSelect: a.toggleBackground},
      {role: "toggleFullScreen"},
    ]},
    {label: t("app_menu.window"), submenu: [{role: "minimize"}, {role: "zoom"}]},
    {label: t("app_menu.help"), submenu: [
      {label: t("app_menu.website"), onSelect: () => openExternal(links.website)},
      {label: t("app_menu.github"), onSelect: () => openExternal(links.repo)},
      {label: t("app_menu.issue"), onSelect: () => openExternal(links.issues)},
      {type: "separator"},
      {label: t("app_menu.sponsor"), onSelect: () => openExternal(links.sponsor)},
    ]},
  ]));
}
