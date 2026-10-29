/**
 * Display-name resolution.
 *
 * Plugin metadata is split across three unrelated places: the browser shows
 * `locale/zh.json` → `meta.title`, npm knows the package name, GitHub knows the
 * repository. This module walks a four-step ladder and always reports which
 * step answered, so the UI can show the provenance instead of pretending the
 * name is authoritative.
 *
 * @module dsh-installed-inventory/naming
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const LOCALE_DIRS = ["locale", "locales", "i18n"];

/**
 * Resolve display names for one package.
 * @param {string} pkgDir - absolute package directory.
 * @param {object} manifest - the package's parsed package.json.
 * @param {string} fallbackName - package name.
 * @returns {{names:string[], source:'locale'|'manifest'|'bundle'|'fallback'}}
 */
export function resolveDisplayNames(pkgDir, manifest, fallbackName) {
  const fromLocale = readLocaleTitles(pkgDir);
  if (fromLocale.length > 0) return { names: dedupe(fromLocale), source: "locale" };

  const fromManifest = manifestNames(manifest);
  if (fromManifest.length > 0) return { names: dedupe(fromManifest), source: "manifest" };

  const fromBundle = readBundleLabels(pkgDir, manifest);
  if (fromBundle.length > 0) return { names: dedupe(fromBundle), source: "bundle" };

  return { names: [fallbackName], source: "fallback" };
}

/**
 * Read `meta.title` (and siblings) from every Chinese locale file.
 * @param {string} pkgDir - absolute package directory.
 * @returns {string[]} titles, most specific first.
 */
export function readLocaleTitles(pkgDir) {
  const titles = [];
  for (const dirName of LOCALE_DIRS) {
    const dir = join(pkgDir, dirName);
    let files = [];
    try {
      files = readdirSync(dir);
    } catch {
      continue;
    }
    for (const file of files) {
      if (!/\.json$/i.test(file)) continue;
      if (!/(^|[^a-z])zh/i.test(file)) continue;
      try {
        const parsed = JSON.parse(readFileSync(join(dir, file), "utf8"));
        const title = parsed?.meta?.title ?? parsed?.meta?.displayName ?? parsed?.meta?.name;
        if (typeof title === "string" && title.trim() !== "") titles.push(title.trim());
      } catch {
        // A corrupt locale file must never break the inventory.
      }
    }
    if (titles.length > 0) break;
  }
  return titles;
}

/**
 * Manifest-declared names, if the author provided one.
 * @param {object} manifest - parsed package.json.
 * @returns {string[]} declared names.
 */
function manifestNames(manifest) {
  const candidates = [
    manifest?.displayName,
    manifest?.dsh?.displayName,
    manifest?.dsh?.name,
    manifest?.ui?.name,
  ];
  return candidates.filter((value) => typeof value === "string" && value.trim() !== "").map((v) => v.trim());
}

/**
 * Last static resort: the label a plugin passes when it registers a Settings
 * section or tab. Many plugins inline their dictionary in the client bundle, so
 * a Chinese literal next to `nav` / `title` / `label` is a good hint.
 * @param {string} pkgDir - absolute package directory.
 * @param {object} manifest - parsed package.json.
 * @returns {string[]} candidate labels.
 */
export function readBundleLabels(pkgDir, manifest) {
  const file = clientEntryPath(pkgDir, manifest);
  if (file === null) return [];
  let text = "";
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return [];
  }
  if (text.length > 6_000_000) return [];
  // Key priority matters: `title` is what a section is called, `nav` is what the
  // navigation entry says. Trying keys in order avoids picking a toolbar label.
  const keys = ["title", "displayName", "sectionLabel", "nav", "label"];
  for (const key of keys) {
    const pattern = new RegExp(`\\b${key}\\s*:\\s*(["'])([^"'\\\\]{1,24})\\1`, "g");
    let match = pattern.exec(text);
    while (match !== null) {
      const value = match[2];
      if (/[\u4e00-\u9fff]/.test(value)) return [value];
      match = pattern.exec(text);
    }
  }
  return [];
}

/**
 * Resolve the client bundle path from manifest `exports`.
 * @param {string} pkgDir - absolute package directory.
 * @param {object} manifest - parsed package.json.
 * @returns {string|null} absolute file path, or null when the plugin has no UI.
 */
export function clientEntryPath(pkgDir, manifest) {
  const exported = manifest?.exports?.["./client"];
  let relative = null;
  if (typeof exported === "string") relative = exported;
  else if (exported !== null && typeof exported === "object") {
    relative = exported.default ?? exported.import ?? null;
  }
  if (typeof relative !== "string") return null;
  return join(pkgDir, relative.replace(/^\.\//, ""));
}

/**
 * Drop duplicates while keeping order.
 * @param {string[]} values - candidate strings.
 * @returns {string[]} unique strings.
 */
function dedupe(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}
