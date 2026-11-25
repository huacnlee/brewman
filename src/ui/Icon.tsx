import { Icon as SetIcon } from "nsh-icon";
import {
  AppWindow, ArrowRight, Check, CircleAlert, CircleArrowUp, GitBranch, Globe, Heart, Info, Menu, MessageSquare,
  Package, Power, RefreshCw, Search, Terminal, Trash,
} from "nsh-icon-lucide";

const icons = {
  alert: CircleAlert, apps: AppWindow, arrow: ArrowRight, box: Package, branch: GitBranch, check: Check, globe: Globe,
  heart: Heart, info: Info, menu: Menu, message: MessageSquare, power: Power, refresh: RefreshCw, search: Search,
  terminal: Terminal, trash: Trash, update: CircleArrowUp,
};
const sizes = {xs: 12, sm: 14, md: 16, lg: 20};
const tones = {
  foreground: "text-foreground", soft: "text-soft", subtle: "text-subtle", primary: "text-primary",
  "primary-foreground": "text-primary-foreground", danger: "text-danger", success: "text-success",
};

export type IconName = keyof typeof icons;
export type IconTone = keyof typeof tones;

/** One Lucide stroke family, tinted by a theme token. Decorative: the control around it carries the name. */
export function Icon(p: {name: IconName; tone?: IconTone; size?: keyof typeof sizes}) {
  return <SetIcon icon={icons[p.name]} size={sizes[p.size || "md"]} class={tones[p.tone || "subtle"]}/>;
}
