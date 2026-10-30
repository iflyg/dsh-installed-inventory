/**
 * UI-text fingerprints: the strings a plugin's interface actually shows.
 *
 * The display-name ladder answers "what is this plugin called", but a user
 * rarely searches for a package name — they search for the words they can SEE:
 * the settings-menu title, the tab label, a card heading. Those often never
 * appear in package.json or locale files: `dsh-brief-sidebar` registers the
 * settings section titled 「起子插件设置」 at runtime (as the family-host
 * backstop), so the only static trace is a string literal inside the bundle.
 *
 * This module harvests those literals — CJK copy plus short literals that sit
 * next to a slot registration — and tags each with WHERE it was found, so the
 * panel can search them and the detail sheet can show them as evidence. It is
 * static inference by design: labels that a *different* plugin injects at
 * runtime belong to that plugin, not this one.
 *
 * @module dsh-installed-inventory/ui-texts
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { clientEntryPath } from "./naming.js";

/** Slot-name fragments mapped to a human seat label key. */
const SEAT_HINTS = [
  ["menu", "settings.section"],
  ["tab", "plugins.tab"],
  ["config", "plugins.bundle.config"],
  ["family", "dsh-family.tab"],
  ["sidebar", "sidebar.right"],
  ["sidebar", "sidebar.left"],
  ["chat", "conversation.input"],
  ["chat", "conversation."],
  ["overlay", "overlay"],
];

const CJK = /[\u4e00-\u9fff\u3400-\u4dbf]/;
const MIN_LEN = 2;
const MAX_LEN = 24;
const PROBE_WINDOW = 400;
const MAX_TEXTS = 24;

/**
 * Harvest UI-text candidates for one package.
 * @param {string} pkgDir - absolute package directory.
 * @param {object} manifest - parsed package.json.
 * @param {string} fallbackName - package name, excluded from the results.
 * @returns {{text:string,where:string,count:number}[]} candidates, best first.
 */
export function extractUiTexts(pkgDir, manifest, fallbackName) {
  const counts = new Map();
  const bump = (text, where) => {
    const key = text;
    const entry = counts.get(key) ?? { text, where, count: 0 };
    // A seat tag sticks once found; later occurrences don't downgrade it.
    if (entry.where === "copy" && where !== "copy") entry.where = where;
    entry.count += 1;
    counts.set(key, entry);
  };

  for (const [text, where] of localeValues(pkgDir)) bump(text, where);

  const clientFile = clientEntryPath(pkgDir, manifest);
  if (clientFile !== null) {
    const source = safeRead(clientFile);
    if (source !== "") harvestBundle(source, fallbackName, bump);
  }

  const ranked = [...counts.values()]
    .filter((entry) => usable(entry.text, fallbackName))
    .sort((a, b) => {
      const seatA = a.where === "copy" ? 1 : 0;
      const seatB = b.where === "copy" ? 1 : 0;
      if (seatA !== seatB) return seatA - seatB;
      if (b.count !== a.count) return b.count - a.count;
      return a.text.localeCompare(b.text, "zh-Hans-CN");
    })
    .slice(0, MAX_TEXTS);
  return ranked;
}

/**
 * String literals from the client bundle, tagged by the nearest slot seat.
 * @param {string} source - client bundle source.
 * @param {string} fallbackName - package name to exclude.
 * @param {(text:string, where:string)=>void} bump - sink.
 * @returns {void}
 */
function harvestBundle(source, fallbackName, bump) {
  const literal = /"([^"\\\n]{1,80})"|'([^'\\\n]{1,80})'/g;
  let match;
  while ((match = literal.exec(source)) !== null) {
    const text = (match[1] ?? match[2] ?? "").trim();
    if (!CJK.test(text)) {
      // Non-CJK literals only matter when they sit right next to a seat —
      // that is how `plugins.tab` labels like "backup" show up. Restrict to
      // single lowercase words: camelCase and dotted shapes are identifiers,
      // not copy.
      if (!/^[a-z][a-z-]{1,}$/.test(text)) continue;
      const seatNear = seatOf(source, match.index);
      if (seatNear !== null && usable(text, fallbackName)) bump(text, seatNear);
      continue;
    }
    bump(text, seatOf(source, match.index) ?? "copy");
  }
}

/**
 * The seat whose needle appears closest to `at`, or null when none is near.
 * @param {string} source - bundle source.
 * @param {number} at - literal offset.
 * @returns {string|null} seat key.
 */
function seatOf(source, at) {
  let best = null;
  let bestDistance = PROBE_WINDOW;
  for (const [seat, needle] of SEAT_HINTS) {
    let from = Math.max(0, at - PROBE_WINDOW);
    const window = source.slice(from, at + PROBE_WINDOW);
    const idx = window.indexOf(needle);
    if (idx === -1) continue;
    const distance = Math.abs(idx + from - at);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = seat;
    }
  }
  return best;
}

/**
 * Every string value in the package's Chinese locale files.
 * @param {string} pkgDir - absolute package directory.
 * @returns {[string,string][]} [value, "locale"] pairs.
 */
function* localeValues(pkgDir) {
  for (const dirName of ["locale", "locales", "i18n"]) {
    let files = [];
    try {
      files = readdirSync(join(pkgDir, dirName));
    } catch {
      continue;
    }
    for (const file of files) {
      if (!/\.json$/i.test(file) || !/(^|[^a-z])zh/i.test(file)) continue;
      let parsed;
      try {
        parsed = JSON.parse(readFileSync(join(pkgDir, dirName, file), "utf8"));
      } catch {
        continue;
      }
      for (const value of flatStrings(parsed)) yield [value, "locale"];
    }
  }
}

/**
 * Depth-first string values of a parsed JSON document.
 * @param {unknown} node - any JSON value.
 * @param {string[]} out - accumulator.
 * @param {number} depth - recursion guard.
 * @returns {string[]} strings.
 */
function flatStrings(node, out = [], depth = 0) {
  if (depth > 6) return out;
  if (typeof node === "string") out.push(node.trim());
  else if (Array.isArray(node)) for (const child of node) flatStrings(child, out, depth + 1);
  else if (node !== null && typeof node === "object") for (const child of Object.values(node)) flatStrings(child, out, depth + 1);
  return out;
}

/** Generic identifiers that keep sneaking next to slot needles but are not UI. */
const STOP = new Set([
  "function", "slots", "slot", "locale", "locales", "i18n", "tab", "tabs", "name", "label", "title",
  "nav", "plugin", "plugins", "client", "host", "render", "inject", "register", "default", "return",
  "overlay", "sidebar", "conversation", "settings", "section", "config", "priority", "order", "id",
  "menu", "chat", "family", "children", "kind", "text", "props", "state", "ctx", "effect", "compose",
  "list", "references", "component", "panel", "card", "view", "modal", "button", "input", "form",
]);

/**
 * A candidate is worth keeping: short, label-shaped, not the package name.
 * @param {string} text - candidate.
 * @param {string} fallbackName - package name.
 * @returns {boolean} true when usable.
 */
function usable(text, fallbackName) {
  if (text.length < MIN_LEN || text.length > MAX_LEN) return false;
  if (text === fallbackName) return false;
  if (/[。！？；…<>{}$`\\]|=>|\/\//.test(text)) return false;
  // Dotted slot paths (`settings.plugins.tab`) are machinery, not copy.
  if (/^[A-Za-z][\w-]*(\.[A-Za-z][\w-]*)+$/.test(text)) return false;
  if (STOP.has(text.toLowerCase())) return false;
  if (/^(dsh|@)/.test(text) && !CJK.test(text)) return false;
  return true;
}

/**
 * Read a file, tolerating absence and absurd sizes.
 * @param {string} path - absolute path.
 * @returns {string} contents or "".
 */
function safeRead(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}
