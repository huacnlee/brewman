import { createAnimatedValue, effect, Image, token, keymap, reduceMotion, computed, Scroll, List, mount, signal, Text, View } from "nsh";
import appIcon from "./assets/icon.png";
import eyesGlyph from "./src/ui/icons/eyes.svg";
import { Menu } from "nsh/desktop";
import { t } from "nsh/i18n";
import { Checkbox, Dialog } from "nsh/base";
import { brew, inventory, modify, type Package } from "./src/brew";
import { Button, Chip, Field, KindTile, LetterIndex, NavItem, PackageRow, SearchField, Spinner, display, letterOf } from "./src/ui/controls";
import { appInfo, Storage, type ListRef } from "nsh";
import { installAppMenu, toolbarMenuItems } from "./src/menu";
import { DropdownMenu } from "./src/ui/menu";
import { links, openExternal } from "./src/links";
import { Icon, type IconName } from "./src/ui/Icon";
import { motionTokens, revealOn } from "./src/ui/motion";
import { TitleBar } from "./src/ui/TitleBar";
import { NightScene } from "./src/ui/NightScene";

type Section = {id: "all" | "Formula" | "Cask" | "updates"; label: string; icon: IconName};
const sections: Section[] = [
  {id: "all", label: "nav.all", icon: "box"},
  {id: "Formula", label: "nav.formula", icon: "terminal"},
  {id: "Cask", label: "nav.cask", icon: "apps"},
  {id: "updates", label: "nav.updates", icon: "update"},
];
const key = (p: Package) => p.kind + "/" + p.id;
/** The status bar shows a message's last non-empty line: brew puts its summary there. */
const lastLine = (text: string) => text.split("\n").map(l => l.trim()).filter(Boolean).pop() || "";
const reason = (error: unknown) => error instanceof Error ? error.message : String(error);

function App() {
  const background = signal(false);
  const backgroundReady = signal(false);
  void Storage.getItem("showNightScene").then(value => {
    background.set(value !== "false");
    backgroundReady.set(true);
  }).catch(error => {
    background.set(true);
    backgroundReady.set(true);
    console.error("Could not read background setting", error);
  });
  const compact = signal(false);
  const packages = signal<Package[]>([]);
  const section = signal<Section>(sections[0]);
  const query = signal("");
  const selected = signal("");
  const selectedUpdates = signal<string[]>([]);
  const busy = signal("");
  const loaded = signal(false);
  const message = signal<{text: string; tone: "done" | "error"} | null>(null);
  const removing = signal<Package | null>(null);
  let cancelButton: {focus(): void} | undefined;
  let searchInput: {focus(): void} | undefined;
  let packageList: ListRef | undefined;
  let aboutClose: {focus(): void} | undefined;
  const aboutOpen = signal(false);

  const matches = (p: Package, id: Section["id"]) => id === "all" || id === p.kind || (id === "updates" && p.outdated);
  const visible = computed(() => packages().filter(p =>
    matches(p, section().id) && p.name.toLowerCase().includes(query().trim().toLowerCase())));
  const item = computed(() => visible().find(p => key(p) === selected()) || visible()[0]);
  const count = (id: Section["id"]) => loaded() ? packages().filter(p => matches(p, id)).length : 0;
  const inspectorMotion = revealOn(() => item() ? key(item()!) : "");
  const feedbackMotion = revealOn(() => busy() || message()?.text || "");

  const navOffset = createAnimatedValue(0);
  effect(() => {
    const destination = sections.indexOf(section()) * (motionTokens.navHeight + motionTokens.navGap);
    if (reduceMotion()) navOffset.set(destination);
    else void navOffset.spring(destination, motionTokens.selectionSpring);
  });
  keymap.bind("mod+f", () => searchInput?.focus());

  async function refresh(label: string, operation?: () => Promise<unknown>, result?: () => string) {
    if (busy()) return;
    busy.set(label);
    message.set(null);
    let failure = "";
    try {
      if (operation) await operation();
    } catch (error) { failure = reason(error); }
    try {
      packages.set(await inventory());
      selectedUpdates.set(selectedUpdates().filter(id => packages().some(p => key(p) === id && p.outdated)));
      loaded.set(true);
    } catch (error) { failure = [failure, reason(error)].filter(Boolean).join("\n"); }
    busy.set("");
    if (failure) message.set({text: failure, tone: "error"});
    else if (result) message.set({text: result(), tone: "done"});
  }
  function upgrade(target: Package) {
    if (busy() || !target.outdated) return;
    void refresh(t("status.upgrading", {name: target.name}), () => modify("upgrade", target), () => {
      const version = packages().find(p => key(p) === key(target))?.installed;
      return t("status.upgraded", {name: target.name, version: version || target.latest});
    });
  }
  function toggleUpdate(target: Package, checked: boolean) {
    selectedUpdates.set(checked ? [...selectedUpdates().filter(id => id !== key(target)), key(target)] : selectedUpdates().filter(id => id !== key(target)));
  }
  function selectVisibleUpdates() {
    const ids = visible().filter(p => p.outdated).map(key);
    const allSelected = ids.every(id => selectedUpdates().includes(id));
    selectedUpdates.set(allSelected ? selectedUpdates().filter(id => !ids.includes(id)) : [...new Set([...selectedUpdates(), ...ids])]);
  }
  function upgradeSelected() {
    const targets = packages().filter(p => p.outdated && selectedUpdates().includes(key(p)));
    if (busy() || !targets.length) return;
    void refresh(t("status.upgrading_selected", {count: targets.length}), async () => {
      const failures: string[] = [];
      for (const target of targets) {
        try { await modify("upgrade", target); }
        catch (error) { failures.push(`${target.name}: ${reason(error)}`); }
      }
      if (failures.length) throw new Error(failures.join(" | "));
    }, () => t("status.upgraded_selected", {count: targets.length}));
  }
  function updateHomebrew() {
    void refresh(t("status.updating"), () => brew(["update"]), () =>
      count("updates") ? t("status.updates_found", {count: count("updates")}) : t("empty.all_current"));
  }
  function openRowMenu(target: Package, at: {x: number; y: number}) {
    selected.set(key(target));
    void Menu.popup([
      {label: t("menu.upgrade"), disabled: !!busy() || !target.outdated, onSelect: () => upgrade(target)},
      {label: t("menu.uninstall"), disabled: !!busy(), onSelect: () => { if (!busy()) removing.set(target); }},
    ], at);
  }

  /** The letter of the row at the top of the list, lit in the letter index. */
  const topLetter = signal("");
  const lettersPresent = computed(() => new Set(visible().map(p => letterOf(p.name))));
  function jumpTo(letter: string) {
    const index = visible().findIndex(p => letterOf(p.name) === letter);
    if (index < 0) return;
    selected.set(key(visible()[index]));
    topLetter.set(letter);
    packageList?.scrollToIndex({index, animated: !reduceMotion()});
  }
  function trackTop() {
    void packageList?.measureScrollPosition().then(position => {
      const row = position && visible()[position.index];
      if (row) topLetter.set(letterOf(row.name));
    });
  }

  const menuActions = {
    about: () => aboutOpen.set(true),
    background: () => background(),
    backgroundReady: () => backgroundReady(),
    toggleBackground: () => {
      const next = !background();
      backgroundReady.set(false);
      background.set(next);
      void Storage.setItem("showNightScene", String(next)).catch(error => {
        background.set(!next);
        console.error("Could not save background setting", error);
        message.set({text: t("errors.background_setting"), tone: "error"});
      }).finally(() => backgroundReady.set(true));
    },
    updateHomebrew,
    find: () => searchInput?.focus(),
    busy: () => !!busy(),
    sections: () => sections.map(s => ({label: t(s.label), selected: section() === s, select: () => section.set(s)})),
  };
  installAppMenu(menuActions);

  void refresh(t("status.loading"));

  const sidebarWidth = () => compact() ? 184 : 208;

  return <View class="flex-1 bg-background" onLayout={e => compact.set(e.bounds.size.width < 980)}>
    <If when={background()}><NightScene/></If>
    <TitleBar brandWidth={sidebarWidth()}
      brand={<>
        <Image src={eyesGlyph} accessibilityElementsHidden class="w-6 h-3" style={{tintColor: token("primary")}}/>
        <Text style={{...display, fontSize: 14, letterSpacing: 3.2}} class="text-foreground">Brewman</Text>
      </>}
      title={<>
        <Text class="text-sm font-medium text-foreground">{t(section().label)}</Text>
        <Text class="font-mono text-xs text-subtle">{loaded() ? visible().length : ""}</Text>
      </>}
      actions={<View class="flex-row items-center gap-2.5">
        <SearchField class={compact() ? "w-44" : "w-56"} value={query()} change={q => query.set(q)}
          shortcut={keymap.label("mod+f")} inputRef={node => { searchInput = node; }}/>
        <DropdownMenu label={t("toolbar.menu")} icon="menu" items={() => toolbarMenuItems(menuActions)}/>
      </View>}/>

    <View class="flex-1 flex-row">
    <View class="border-r border-foreground/10 bg-background/30" style={{width: sidebarWidth()}}>
      <Text style={{...display, fontSize: 11, letterSpacing: 2.2}} class="px-4 pb-2 pt-5 text-subtle">{t("nav.library")}</Text>
      <View class="px-2.5" style={{gap: motionTokens.navGap}}>
        <View class="absolute left-2.5 right-2.5 top-0 border-l-2 border-primary bg-foreground/10"
          style={{height: motionTokens.navHeight, translate: [0, navOffset]}}/>
        <Each of={sections}>{s => <NavItem label={t(s().label)} icon={s().icon} selected={section() === s()}
          count={loaded() ? String(count(s().id)) : "—"} alert={s().id === "updates" && count("updates") > 0}
          press={() => section.set(s())}/>}</Each>
      </View>
      <View class="flex-1"/>
      <View class="gap-1 border-t border-foreground/10 px-4 py-3">
        <View class="flex-row items-center gap-2">
          <View style={{rotate: "45deg"}} class={`w-1.5 h-1.5 ${loaded() ? "bg-success" : "bg-dot"}`}/>
          <Text class="text-xs text-soft">{t("nav.homebrew")}</Text>
        </View>
        <Text class="font-mono text-xs text-subtle">/opt/homebrew</Text>
      </View>
    </View>

    <View class="flex-1">
      <View class="flex-1 flex-row">
        <View class="flex-1">
          <If when={section().id === "updates" && loaded() && !!visible().length}>
            <View class="flex-row items-center gap-2 border-b border-foreground/10 px-5 py-2">
              <Button label={t(visible().filter(p => p.outdated).every(p => selectedUpdates().includes(key(p))) ? "batch.clear_visible" : "batch.select_visible")} disabled={!!busy()} press={selectVisibleUpdates}/>
              <Button variant="primary" label={t("batch.upgrade_selected", {count: selectedUpdates().length})}
                disabled={!!busy() || !selectedUpdates().length} press={upgradeSelected}/>
            </View>
          </If>
          <If when={loaded() && !!visible().length}>
            <View class="h-8 flex-row items-center gap-3 border-b border-foreground/10 px-5">
              <Text class="flex-1 text-xs text-subtle">{t("table.package")}</Text>
              <If when={!compact()}><Text class="w-24 text-xs text-subtle">{t("table.installed")}</Text></If>
              <Text class="w-26 text-xs text-subtle">{t("table.latest")}</Text>
            </View>
            <View class="flex-1 flex-row">
            <List ref={node => { packageList = node; }} onScroll={trackTop} each={visible()} keyExtractor={key} estimatedItemSize={44} class="flex-1 px-2 py-1">
              {row => <View class="flex-row items-center">
              <If when={section().id === "updates"}><Checkbox checked={selectedUpdates().includes(key(row()))} disabled={!!busy()}
                accessibilityLabel={t("batch.select_package", {name: row().name})}
                onChange={e => toggleUpdate(row(), e.checked)}
                class="w-8 h-10 items-center justify-center focus-visible:ring-1 focus-visible:ring-ring"
                indicatorClass="w-4 h-4 border border-border-strong checked:bg-primary"
                indicator={selectedUpdates().includes(key(row())) ? <Icon name="check" size="xs"/> : null}/></If>
              <View class="flex-1"><PackageRow testID={key(row())} name={row().name} desc={row().desc || row().kind}
                installed={row().installed} outdated={row().outdated} status={row().outdated ? row().latest : t("table.up_to_date")}
                cask={row().kind === "Cask"} compact={compact()} selected={!!item() && key(item()!) === key(row())}
                press={() => selected.set(key(row()))} menu={at => openRowMenu(row(), at)}/></View></View>}
            </List>
            <LetterIndex present={letter => lettersPresent().has(letter)} current={topLetter()} press={jumpTo}/>
            </View>
          </If>
          <If when={loaded() && !visible().length}>
            <View class="flex-1 items-start gap-2 px-5 py-6">
              <If when={!!query().trim()} else={<>
                <Text class="text-sm text-foreground">{section().id === "updates" ? t("empty.all_current") : t("empty.category")}</Text>
              </>}>
                <Text class="text-sm text-foreground">{t("empty.no_match", {query: query().trim()})}</Text>
                <Text class="text-xs text-subtle">{t("empty.no_match_hint")}</Text>
                <Button label={t("empty.clear_search")} press={() => query.set("")}/>
              </If>
            </View>
          </If>
          <If when={!loaded()}><View class="flex-1"/></If>

          <View class="h-7 flex-row items-center justify-between gap-3 border-t border-foreground/10 px-5">
            <Text class="shrink-0 text-xs text-subtle">
              {loaded() ? t("status.totals", {total: packages().length, updates: count("updates")}) : ""}</Text>
            <View style={feedbackMotion} class="min-w-0 flex-1 flex-row items-center justify-end gap-1.5">
              <If when={!!busy()}><Spinner/><Text class="text-xs text-foreground">{busy()}</Text></If>
              <If when={!busy() && !!message()}>
                <Icon name={message()?.tone === "error" ? "alert" : "check"} tone={message()?.tone === "error" ? "danger" : "success"} size="xs"/>
                <Text style={{numberOfLines: 1}} class={`shrink text-xs ${message()?.tone === "error" ? "text-danger" : "text-soft"}`}>{lastLine(message()?.text || "")}</Text>
              </If>
            </View>
          </View>
        </View>

        <If when={!!item()}>
          <View selectable style={inspectorMotion} class={`border-l border-foreground/10 bg-background/40 ${compact() ? "w-62" : "w-75"}`}>
            <Scroll class="flex-1">
              <View class="gap-5 p-5">
                <View class="flex-row items-center gap-3">
                  <KindTile cask={item()?.kind === "Cask"} size="lg"/>
                  <View class="flex-1 gap-0.5">
                    <Text style={{numberOfLines: 1}} class="text-lg font-semibold text-foreground">{item()?.name}</Text>
                    <Text style={{numberOfLines: 1}} class="font-mono text-xs text-subtle">{item()?.tap}</Text>
                  </View>
                </View>
                <If when={!!item()?.desc}><Text class="text-sm text-soft">{item()?.desc}</Text></If>
                <If when={!!item()?.outdated} else={
                  <View class="flex-row items-center gap-2 border border-foreground/10 bg-foreground/5 px-3 py-2.5">
                    <Icon name="check" tone="success" size="sm"/><Text class="text-sm text-soft">{t("inspector.current")}</Text>
                  </View>}>
                  <View class="gap-3 border border-primary/30 bg-primary/5 p-3.5">
                    <Text style={{...display, fontSize: 11, letterSpacing: 2}} class="text-primary">{t("inspector.new_version")}</Text>
                    <View class="flex-row items-center gap-2">
                      <Text class="font-mono text-base text-soft">{item()?.installed}</Text>
                      <Icon name="arrow" tone="subtle" size="sm"/>
                      <Text class="font-mono text-base text-primary">{item()?.latest}</Text>
                    </View>
                    <Button variant="primary" size="md" label={t("inspector.upgrade_to", {version: item()?.latest})} disabled={!!busy()}
                      press={() => { const target = item(); if (target) upgrade(target); }}/>
                  </View>
                </If>
                <View>
                  <Field label={t("inspector.kind")} value={item()?.kind || ""}/>
                  <Field label={t("inspector.installed")} value={item()?.installed || ""} mono/>
                  <Field label={t("inspector.latest")} value={item()?.latest || ""} mono/>
                  <Field label={t("inspector.tap")} value={item()?.tap || ""} mono/>
                </View>
                <If when={!!item()?.dependencies.length}>
                  <View class="gap-2">
                    <Text class="text-xs text-subtle">{t("inspector.dependencies", {count: item()?.dependencies.length})}</Text>
                    <View class="flex-row flex-wrap gap-1.5"><Each of={item()?.dependencies || []}>{d => <Chip label={d()}/>}</Each></View>
                  </View>
                </If>
              </View>
            </Scroll>
            <View class="border-t border-foreground/10 p-5">
              <Button variant="danger" size="md" icon="trash" label={t("inspector.uninstall")} disabled={!!busy()}
                press={() => removing.set(item() || null)}/>
            </View>
          </View>
        </If>
      </View>
    </View>
    </View>

    <Dialog open={!!removing()} animation={reduceMotion() ? "none" : "fade"} role="alertdialog" accessibilityLabel={t("dialog.title", {name: removing()?.name || ""})}
      onOpen={() => cancelButton?.focus()} onOpenChange={e => { if (!e.open) removing.set(null); }}
      class="flex-1 items-center justify-center" backdropClass="bg-background/70">
      <View class="w-86 gap-4 border border-border-strong bg-card p-5">
        <View class="gap-1.5">
          <Text class="text-base font-semibold text-foreground">{t("dialog.title", {name: removing()?.name || ""})}</Text>
          <Text class="text-xs text-soft">{t("dialog.body", {name: removing()?.name || "", version: removing()?.installed || ""})}</Text>
        </View>
        <View class="flex-row justify-end gap-2">
          <Button buttonRef={node => { cancelButton = node; }} label={t("dialog.cancel")} press={() => removing.set(null)}/>
          <Button variant="danger-solid" label={t("dialog.confirm")} press={() => {
            const target = removing(); removing.set(null);
            if (target) void refresh(t("status.uninstalling", {name: target.name}), () => modify("uninstall", target), () => t("status.uninstalled", {name: target.name}));
          }}/>
        </View>
      </View>
    </Dialog>

    <Dialog open={aboutOpen()} animation={reduceMotion() ? "none" : "fade"} accessibilityLabel={t("app_menu.about")}
      onOpen={() => aboutClose?.focus()} onOpenChange={e => { if (!e.open) aboutOpen.set(false); }}
      class="flex-1 items-center justify-center" backdropClass="bg-background/70">
      <View class="w-96 gap-5 border border-border-strong bg-card p-6">
        <View class="flex-row items-center gap-4">
          <Image src={appIcon} accessibilityElementsHidden class="w-16 h-16"/>
          <View class="flex-1 gap-1">
            <Text style={{...display, fontSize: 20, letterSpacing: 4}} class="text-foreground">Brewman</Text>
            <Text class="text-xs text-soft">{t("about.tagline")}</Text>
            <Text class="font-mono text-xs text-subtle">{t("about.version", {version: appInfo().version || "dev"})}</Text>
          </View>
        </View>
        <Text class="text-xs text-soft">{t("about.body")}</Text>
        <View class="flex-row flex-wrap gap-2">
          <Button label={t("about.website")} press={() => openExternal(links.website)}/>
          <Button label={t("about.github")} press={() => openExternal(links.repo)}/>
          <Button variant="primary" label={t("about.sponsor")} press={() => openExternal(links.sponsor)}/>
        </View>
        <View class="flex-row items-center justify-between border-t border-foreground/10 pt-4">
          <Button variant="ghost" label={t("about.built_with")} press={() => openExternal(links.nsh)}/>
          <Button buttonRef={node => { aboutClose = node; }} label={t("about.close")} press={() => aboutOpen.set(false)}/>
        </View>
      </View>
    </Dialog>
  </View>;
}
mount(App);
