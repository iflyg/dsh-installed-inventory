/**
 * Profile directory resolution.
 *
 * The Host owns this answer: `profileContext.dir` is injected by DSH and is the
 * only value that stays correct when the data directory is moved (this machine
 * moved from `%USERPROFILE%\.dsh` to `E:\DeepSeek Harness\.dsh`).
 *
 * @module dsh-installed-inventory/profile
 */
import { readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

/**
 * Resolve the profile directory the Host is running from.
 * @param {object} ctx - host context, may expose `get("profileContext")`.
 * @param {string} configured - explicit `profileDir` config, or empty.
 * @returns {string} absolute profile directory.
 */
export function resolveProfileDir(ctx, configured) {
  if (typeof configured === "string" && configured.trim() !== "") return resolve(configured.trim());
  const context = typeof ctx?.get === "function" ? ctx.get("profileContext") : undefined;
  if (context !== null && typeof context === "object" && typeof context.dir === "string" && context.dir !== "") {
    return resolve(context.dir);
  }
  const home = typeof process.env.DSH_HOME === "string" && process.env.DSH_HOME.trim() !== ""
    ? process.env.DSH_HOME.trim()
    : join(homedir(), ".dsh");
  return resolve(join(home, "profiles", "desktop"));
}

/**
 * Resolve `<DSH_HOME>` from a profile directory (`<home>/profiles/<name>`).
 * @param {string} profileDir - absolute profile directory.
 * @returns {string} absolute DSH home.
 */
export function resolveDshHome(profileDir) {
  return dirname(dirname(profileDir));
}

/**
 * List sibling profiles so the panel can switch without guessing paths.
 * @param {string} profileDir - absolute profile directory of the active profile.
 * @returns {{name:string, dir:string}[]} every profile with a package.json.
 */
export function listProfiles(profileDir) {
  const root = join(resolveDshHome(profileDir), "profiles");
  const found = [{ name: currentProfileName(profileDir), dir: resolve(profileDir) }];
  let names = [];
  try {
    names = readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return found;
  }
  for (const name of names.sort()) {
    if (name === found[0].name) continue;
    const dir = join(root, name);
    try {
      statSync(join(dir, "package.json"));
      found.push({ name, dir });
    } catch {
      // A profile without a manifest is not loadable; skip it silently.
    }
  }
  return found;
}

/**
 * Read the active profile's name from its directory name.
 * @param {string} profileDir - absolute profile directory.
 * @returns {string} profile name.
 */
export function currentProfileName(profileDir) {
  return resolve(profileDir).split(/[\\/]/).filter(Boolean).pop() ?? "desktop";
}
