/**
 * Snapshot cache.
 *
 * A full scan reads ~65 manifests plus their client bundles; doing that on every
 * settings-page open makes the page feel broken. The cache is keyed by a cheap
 * fingerprint of the three paths that actually change when plugins are
 * installed, so a new package invalidates it immediately without watching any
 * deep directory tree.
 *
 * @module dsh-installed-inventory/cache
 */
import { mkdirSync, readFileSync, renameSync, statSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

/**
 * Directory owned by this plugin. Nothing outside it is ever written.
 * @param {string} dshHome - DSH home directory.
 * @returns {string} absolute storage directory.
 */
export function storageDir(dshHome) {
  return join(dshHome, "storages", "installed-inventory");
}

/**
 * Cheap change detector for one profile.
 *
 * Three paths catch installs and removals: `package.json` (dependency list),
 * `cordis.patch.yml` (enable state) and `node_modules` (top-level entries). A
 * package that is *updated in place* leaves all three untouched, so the
 * declared packages' own manifests are folded in as well — that is ~38 stats,
 * cheap enough to run on every request.
 *
 * @param {string} profileDir - absolute profile directory.
 * @returns {string} fingerprint string.
 */
export function fingerprint(profileDir) {
  const targets = [join(profileDir, "package.json"), join(profileDir, "cordis.patch.yml"), join(profileDir, "node_modules")];
  const parts = targets.map((target) => {
    try {
      const info = statSync(target);
      return `${info.mtimeMs}:${info.size}`;
    } catch {
      return "0:0";
    }
  });

  let declared = [];
  try {
    const manifest = JSON.parse(readFileSync(join(profileDir, "package.json"), "utf8"));
    declared = Object.keys({ ...(manifest.dependencies ?? {}), ...(manifest.devDependencies ?? {}) });
  } catch {
    declared = [];
  }
  for (const name of declared) {
    try {
      const info = statSync(join(profileDir, "node_modules", ...name.split("/"), "package.json"));
      parts.push(`${info.mtimeMs}:${info.size}`);
    } catch {
      parts.push("missing");
    }
  }
  return parts.join("|");
}

/**
 * Read a cached snapshot.
 * @param {string} dshHome - DSH home directory.
 * @param {string} profileName - profile the cache belongs to.
 * @returns {{schema:number,profileName:string,fingerprint:string,snapshot:object}|null} cached entry.
 */
export function readCache(dshHome, profileName) {
  const file = join(storageDir(dshHome), `cache-${safeName(profileName)}.json`);
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    if (parsed?.schema !== 1 || parsed?.profileName !== profileName) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Write a cached snapshot atomically (temp file + rename).
 * @param {string} dshHome - DSH home directory.
 * @param {string} profileName - profile the cache belongs to.
 * @param {string} print - fingerprint the snapshot was produced from.
 * @param {object} snapshot - snapshot document.
 * @returns {void}
 */
export function writeCache(dshHome, profileName, print, snapshot) {
  const dir = storageDir(dshHome);
  const file = join(dir, `cache-${safeName(profileName)}.json`);
  const temp = `${file}.tmp`;
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(temp, JSON.stringify({ schema: 1, profileName, fingerprint: print, snapshot }), "utf8");
    renameSync(temp, file);
  } catch {
    try {
      unlinkSync(temp);
    } catch {
      // Nothing to clean up.
    }
  }
}

/**
 * Make a profile name safe for a filename.
 * @param {string} name - profile name.
 * @returns {string} sanitised name.
 */
function safeName(name) {
  return String(name).replace(/[^A-Za-z0-9_.-]/g, "_");
}
