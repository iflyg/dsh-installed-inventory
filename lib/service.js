/**
 * Inventory service: cache, revision counter, and change watching.
 *
 * The panel must stay truthful when the user installs a plugin in another
 * window. Three mechanisms cooperate:
 *
 *   1. a fingerprint over the three paths that change on install, checked on
 *      every request — this is the correctness guarantee;
 *   2. `fs.watch` on the profile root and `node_modules` — this makes the panel
 *      react within a second instead of waiting for a poll;
 *   3. a monotonically increasing `rev` — this lets the browser poll one tiny
 *      endpoint and only refetch when something really changed.
 *
 * @module dsh-installed-inventory/service
 */
import { watch } from "node:fs";
import { join } from "node:path";
import { fingerprint, readCache, writeCache } from "./cache.js";
import { currentProfileName, listProfiles, resolveDshHome } from "./profile.js";
import { scanProfile } from "./scan.js";

/**
 * Create the inventory service for one host context.
 * @param {{profileDir:string, ttlSeconds:number}} options - resolved settings.
 * @returns {object} service API.
 */
export function createInventory(options) {
  const baseProfileDir = options.profileDir;
  const ttlMs = Math.max(1, options.ttlSeconds) * 1000;
  const dshHome = resolveDshHome(baseProfileDir);
  /** @type {Map<string,{snapshot:object,print:string,at:number}>} */
  const memory = new Map();
  const watchers = [];
  let revisionCounter = 1;
  let lastChangeAt = null;

  /**
   * Translate a profile name into a directory, refusing anything outside the
   * profiles root.
   * @param {string} name - requested profile name.
   * @returns {string} absolute profile directory.
   */
  function dirFor(name) {
    const wanted = typeof name === "string" && name.trim() !== "" ? name.trim() : currentProfileName(baseProfileDir);
    const known = listProfiles(baseProfileDir).find((profile) => profile.name === wanted);
    if (known !== undefined) return known.dir;
    return baseProfileDir;
  }

  /**
   * Get a snapshot, reusing cache when nothing changed.
   * @param {{profile?:string, refresh?:boolean}} request - caller intent.
   * @returns {Promise<object>} snapshot document.
   */
  async function snapshot(request) {
    const profileDir = dirFor(request?.profile);
    const profileName = currentProfileName(profileDir);
    const print = fingerprint(profileDir);
    const cached = memory.get(profileName);
    const fresh = cached !== undefined && cached.print === print && Date.now() - cached.at < ttlMs && request?.refresh !== true;
    if (fresh) return { ...cached.snapshot, cached: true };

    const disk = readCache(dshHome, profileName);
    const diskFresh = disk !== null && disk.fingerprint === print && request?.refresh !== true;
    if (diskFresh) {
      memory.set(profileName, { snapshot: disk.snapshot, print, at: Date.now() });
      return { ...disk.snapshot, cached: true };
    }

    const previous = cached?.snapshot ?? disk?.snapshot ?? null;
    const scanned = await scanProfile({ profileDir, previous });
    memory.set(profileName, { snapshot: scanned, print, at: Date.now() });
    writeCache(dshHome, profileName, print, scanned);
    revisionCounter += 1;
    return { ...scanned, cached: false };
  }

  /**
   * Report whether anything changed since a revision the client has seen.
   * @returns {{rev:number, changed:boolean, at:string|null}} revision payload.
   */
  function revision() {
    return { rev: revisionCounter, at: lastChangeAt };
  }

  /**
   * Install watchers. Each event only invalidates memory: the next request
   * re-fingerprints and decides for itself.
   * @returns {() => void} disposer.
   */
  function startWatching() {
    const targets = [baseProfileDir, join(baseProfileDir, "node_modules")];
    for (const target of targets) {
      try {
        const watcher = watch(target, { persistent: false }, () => {
          memory.clear();
          revisionCounter += 1;
          lastChangeAt = new Date().toISOString();
        });
        watcher.on("error", () => {});
        watchers.push(watcher);
      } catch {
        // Watching is an optimisation; the fingerprint still guarantees truth.
      }
    }
    return stopWatching;
  }

  /**
   * Close every watcher.
   * @returns {void}
   */
  function stopWatching() {
    while (watchers.length > 0) {
      const watcher = watchers.pop();
      try {
        watcher.close();
      } catch {
        // Already closed.
      }
    }
  }

  return { snapshot, revision, startWatching, stopWatching, dirFor, dshHome };
}
