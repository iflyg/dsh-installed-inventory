/**
 * Entry-surface and risk detection.
 *
 * "This plugin adds a settings menu" is not stored anywhere: it is implied by
 * the slot a client bundle registers into. The slot vocabulary below was
 * collected from the shipped app bundle and from the installed plugins, so the
 * matrix reflects what DSH actually renders — `sidebar.right.pane.tab`, not the
 * service name `dsh-client-ui-sidebar-right`.
 *
 * Everything here is heuristic and says so in the UI: labels carry a `~` prefix
 * and the drawer states "static inference".
 *
 * @module dsh-installed-inventory/surfaces
 */
import { readFileSync, statSync } from "node:fs";
import { classifyPackage } from "./categories.js";
import { clientEntryPath } from "./naming.js";

/** Slot-name groups, ordered as they appear in the matrix. */
export const SLOT_GROUPS = [
  { key: "settingsSection", label: "设置菜单", slots: ["settings.section"] },
  { key: "pluginTab", label: "插件页标签", slots: ["plugins.tab", "settings.plugins.tab"] },
  { key: "pluginDetail", label: "插件详情", slots: ["plugins.detail.section", "plugins.detail.badge", "plugins.detail.actions"] },
  { key: "sidebarRight", label: "右侧边栏", slots: ["sidebar.right.pane.tab", "sidebar.panellist"] },
  {
    key: "sidebarLeft",
    label: "左侧栏",
    slots: [
      "sidebar.workspaces",
      "sidebar.session.row",
      "sidebar.channels",
      "sidebar.footer.action",
      "sidebar.schedule",
      "sidebar.settings",
      "sidebar.chat",
    ],
  },
  {
    key: "conversation",
    label: "会话区",
    slots: [
      "conversation.input",
      "conversation.composer",
      "conversation.chat",
      "conversation.session.header",
      "conversation.view",
      "conversation.hero",
      "conversation.header",
    ],
  },
  { key: "overlay", label: "浮层挂件", slots: ["shell.overlay"] },
];

/**
 * Every slot this module knows about, flattened. Used to keep the entry scanner
 * from reporting slots the matrix does not show.
 */
const KNOWN_SLOTS = new Set(SLOT_GROUPS.flatMap((group) => group.slots));

/** Field names inside a `slots.register({...})` object that name the UI item. */
const ENTRY_NAME_KEYS = ["label", "key", "id"];

/**
 * Dictionary keys that name nothing: `label: () => t("tab")` is a placeholder,
 * not the visible caption, so it must not become the "display name" column.
 */
const GENERIC_NAMES = new Set(["tab", "tabs", "title", "label", "name", "section", "panel", "view", "body"]);

/** Window after `name: "<slot>"` searched for the entry's own name. */
const ENTRY_WINDOW = 340;

/** Service injections that imply a surface even without a slot literal. */
const SERVICE_HINTS = [
  { key: "sidebarRight", needle: "dsh-client-ui-sidebar-right" },
  { key: "sidebarLeft", needle: "dsh-client-ui-sidebar" },
  { key: "conversation", needle: "dsh-client-ui-conversation" },
  { key: "settingsSection", needle: "dsh-client-ui-settings" },
];

/** Keyword scoring for the coarse category chip lives in `categories.js`. */

/**
 * Detect which surfaces one package occupies.
 * @param {string} pkgDir - absolute package directory.
 * @param {object} manifest - parsed package.json.
 * @returns {{ui:boolean, surfaces:Record<string,string[]>, risk:string[], category:{key:string,label:string,evidence:string}}}
 */
export function detectSurfaces(pkgDir, manifest) {
  const clientFile = clientEntryPath(pkgDir, manifest);
  const clientText = clientFile === null ? "" : safeRead(clientFile, 8_000_000);
  // Risk and host services are read from the host half only: every browser
  // bundle calls fetch, so scanning client code for "net" would flag all UI.
  const hostText = safeRead(joinSafe(pkgDir, manifest?.main ?? "lib/index.js"), 4_000_000);

  const found = slotSetOf(clientText);

  /** @type {Record<string,string[]>} */
  const surfaces = {};
  for (const group of SLOT_GROUPS) {
    surfaces[group.key] = group.slots.filter((slot) => hasPrefix(found, slot));
  }

  // Service hints only fill gaps: a real slot literal is stronger evidence.
  const injections = Array.isArray(manifest?.dsh?.client?.inject) ? manifest.dsh.client.inject.join(" ") : "";
  for (const hint of SERVICE_HINTS) {
    if (surfaces[hint.key].length > 0) continue;
    if (injections.includes(hint.needle) && hint.key !== "settingsSection") surfaces[hint.key] = [`inject:${hint.needle}`];
  }

  const tools = /tools\.register|ctx\.get\(["']tools["']\)|inject\s*[:=]\s*\[[^\]]*["']tools["']/.test(hostText);
  const command = /commands\.register|ctx\.get\(["']commands["']\)/.test(hostText);
  const route = /connection\.fetch\.register|webserver\/index-inject|ctx\.server/.test(hostText);

  const risk = [];
  if (/child_process|dsh-subprocess|\bexec\(|\bspawn\(/.test(hostText)) risk.push("shell");
  if (/writeFile|createWriteStream|node:fs|require\(["']fs["']\)/.test(hostText)) risk.push("fs");
  if (/\bfetch\(|https\.request|node:net/.test(hostText)) risk.push("net");

  return {
    ui: clientFile !== null,
    surfaces,
    entries: slotEntries(clientText),
    tools,
    command,
    route,
    risk,
    category: classify(manifest, { ui: clientFile !== null, surfaces }),
  };
}

/**
 * Recover what each registration is *called* on screen.
 *
 * The slot literal says where a plugin draws; this says what it draws. A
 * right-sidebar tab registers `key: "files"` and renders its caption from a
 * separate title slot, so the key is the only static handle on the name — and
 * it is the one the user sees next to the tab id in the plugin's own settings.
 *
 * @param {string} clientText - browser bundle source.
 * @returns {{slot:string,name:string}[]} one row per registration with a name.
 */
export function slotEntries(clientText) {
  const out = [];
  if (clientText === "") return out;
  const seen = new Set();
  const pattern = /\bname\s*:\s*["']((?:settings|plugins|sidebar|conversation|shell)\.[A-Za-z][\w.]*)["']/g;
  let match = pattern.exec(clientText);
  while (match !== null) {
    const slot = match[1];
    if (!KNOWN_SLOTS.has(slot)) {
      match = pattern.exec(clientText);
      continue;
    }
    const chunk = clientText.slice(match.index, match.index + ENTRY_WINDOW);
    // Stop at the next registration: its fields are not this one's.
    const nextAt = chunk.slice(1).search(/\bname\s*:\s*["']/);
    const scope = nextAt === -1 ? chunk : chunk.slice(0, nextAt + 1);
    const name = pickEntryName(scope);
    if (name !== null) {
      const key = `${slot}\u0000${name}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ slot, name });
      }
    }
    match = pattern.exec(clientText);
  }
  return out.slice(0, 60);
}

/**
 * First usable caption inside one registration's object literal.
 * @param {string} scope - text window owned by that registration.
 * @returns {string|null} entry name, or null when nothing distinctive exists.
 */
function pickEntryName(scope) {
  for (const field of ENTRY_NAME_KEYS) {
    const pattern = new RegExp(`\\b${field}\\s*:\\s*(?:\\(\\s*\\)\\s*=>\\s*)?["']([^"']{1,48})["']`);
    const match = pattern.exec(scope);
    if (match === null) continue;
    const value = match[1].trim();
    if (value === "" || GENERIC_NAMES.has(value.toLowerCase())) continue;
    if (value.startsWith(".")) continue;
    return value;
  }
  return null;
}

/**
 * Coarse category from name + keywords + description, in the market's taxonomy.
 * @param {object} manifest - parsed package.json.
 * @param {{ui?:boolean, surfaces?:Record<string,string[]>}} [surfaces] - detected surfaces.
 * @returns {{key:string,label:string,evidence:string}} best match.
 */
export function classify(manifest, surfaces = {}) {
  return classifyPackage(manifest, surfaces);
}

/**
 * Collect every slot-shaped string literal in one regex pass. Scanning 17 MB of
 * bundles with 40 separate `includes` calls is what made the first scan slow;
 * one pass plus prefix lookups is roughly an order of magnitude cheaper.
 * @param {string} text - client bundle source.
 * @returns {Set<string>} slot names.
 */
function slotSetOf(text) {
  const found = new Set();
  if (text === "") return found;
  const pattern = /["']((?:settings|plugins|sidebar|conversation|shell|main)\.[A-Za-z][\w.]*)["']/g;
  let match = pattern.exec(text);
  while (match !== null) {
    found.add(match[1]);
    match = pattern.exec(text);
  }
  return found;
}

/**
 * True when a known slot exists as itself or as the prefix of a longer slot
 * (`sidebar.session.row` matches `sidebar.session.row.leading`).
 * @param {Set<string>} found - discovered slot names.
 * @param {string} slot - slot to look for.
 * @returns {boolean} presence.
 */
function hasPrefix(found, slot) {
  if (found.has(slot)) return true;
  for (const value of found) {
    if (value.startsWith(`${slot}.`)) return true;
  }
  return false;
}

/**
 * Read a file, tolerating absence and size blowups.
 * @param {string} file - absolute path.
 * @param {number} limit - byte ceiling.
 * @returns {string} file content, or "" on any failure.
 */
function safeRead(file, limit) {
  try {
    if (statSync(file).size > limit) return "";
    return readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

/**
 * Join a path without importing platform branches at call sites.
 * @param {string} dir - base directory.
 * @param {string} rel - relative path.
 * @returns {string} absolute path.
 */
function joinSafe(dir, rel) {
  return `${dir.replace(/[\\/]+$/, "")}/${String(rel).replace(/^\.\//, "").replace(/\\/g, "/")}`;
}
