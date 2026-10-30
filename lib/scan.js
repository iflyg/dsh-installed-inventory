/**
 * Profile scan: the one function that turns a directory into a snapshot.
 *
 * Everything is read-only. The scanner never writes to the profile, never
 * imports a plugin's code, and tolerates any single package failing to parse —
 * one broken manifest must not blank the whole panel.
 *
 * @module dsh-installed-inventory/scan
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { buildFamilies } from "./family.js";
import { resolveDisplayNames, readLocaleTitles } from "./naming.js";
import { parsePatch } from "./patch.js";
import { currentProfileName, listProfiles, resolveDshHome } from "./profile.js";
import { detectSurfaces } from "./surfaces.js";
import { buildWarnings } from "./warnings.js";

const CONCURRENCY = 8;
const HOST_SCOPES = ["@deepseek-ai/"];

/**
 * Scan one profile directory.
 * @param {{profileDir:string, previous?:object|null}} options - scan inputs.
 * @returns {Promise<object>} snapshot document.
 */
export async function scanProfile(options) {
  const startedAt = Date.now();
  const profileDir = options.profileDir;
  const previous = options.previous ?? null;

  let manifest = {};
  let manifestError = null;
  try {
    manifest = JSON.parse(readFileSync(join(profileDir, "package.json"), "utf8"));
  } catch (error) {
    manifestError = error instanceof Error ? error.message : String(error);
  }

  const declared = { ...(manifest.dependencies ?? {}), ...(manifest.devDependencies ?? {}) };
  const bundles = Array.isArray(manifest?.dsh?.profile?.bundles) ? manifest.dsh.profile.bundles : [];

  let patchText = "";
  try {
    patchText = readFileSync(join(profileDir, "cordis.patch.yml"), "utf8");
  } catch {
    patchText = "";
  }
  const patch = parsePatch(patchText);
  const patchById = new Map();
  for (const entry of patch.entries) {
    const list = patchById.get(entry.id) ?? [];
    list.push(entry);
    patchById.set(entry.id, list);
  }

  const candidates = listPluginDirs(profileDir);
  const records = [];
  for (let i = 0; i < candidates.length; i += CONCURRENCY) {
    const batch = candidates.slice(i, i + CONCURRENCY);
    const settled = await Promise.all(batch.map((dir) => readPackage(profileDir, dir)));
    for (const record of settled) if (record !== null) records.push(record);
  }

  // Attach patch rows: match by package name first, then by id when a row is
  // disable-only (`- id: x` with `disabled: true` and no `name`).
  const byName = new Map(records.map((record) => [record.name, record]));
  const idToName = new Map();
  for (const [id, entries] of patchById) {
    const named = entries.find((entry) => entry.name !== "");
    if (named !== undefined) idToName.set(id, named.name);
  }
  for (const record of records) {
    record.patchEntries = [];
  }
  for (const [id, entries] of patchById) {
    const name = idToName.get(id) ?? null;
    const target = name === null ? null : byName.get(name);
    if (target === undefined || target === null) continue;
    for (const entry of entries) target.patchEntries.push({ id, line: entry.line, disabled: entry.disabled, hasConfig: entry.hasConfig });
  }

  const bundleSet = new Set(bundles);
  const mountedBy = new Map();
  for (const record of records) {
    for (const dep of Object.keys(record.rawDependencies ?? {})) {
      if (byName.has(dep)) mountedBy.set(dep, record.name);
    }
  }

  for (const record of records) {
    record.declaredVersion = declared[record.name] ?? "";
    record.declared = Object.prototype.hasOwnProperty.call(declared, record.name);
    record.inBundles = bundleSet.has(record.name);
    record.mountedBy = mountedBy.get(record.name) ?? null;
    record.enabled = resolveEnabled(record.patchEntries);
    record.profile = currentProfileName(profileDir);
    record.hasLocale = readLocaleTitles(record.dir).length > 0;
    delete record.dependencies;
  }

  const { families, byName: familyByName } = buildFamilies(
    records.map((record) => ({
      name: record.name,
      repo: record.repo,
      dependencies: record.rawDependencies ?? {},
    }))
  );
  for (const record of records) {
    record.family = familyByName[record.name] ?? { key: record.name, label: record.name, isAggregate: false };
    // The list groups by family author, so a plugin that declares neither a
    // scope nor a repository still sits under a recognisable publisher in the
    // group header. The detail panel reads `plugin.author`, which used to stay
    // empty for exactly those packages and printed "—" while the list above it
    // showed the publisher. Inherit the family author as a fallback and flag it,
    // so the panel can say where the name came from instead of inventing one.
    if (record.author === "" || record.author === undefined) {
      const inherited = record.family?.author ?? "";
      record.author = inherited;
      record.authorFromFamily = inherited !== "";
    } else {
      record.authorFromFamily = false;
    }
    // A suite package installs its siblings; shelving it under "market &
    // management" is what the market does, and it keeps `dsh-web-all` from
    // being filed under whatever its description happens to mention first.
    if (/(^|[-_])(all|suite|pack|bundle)([-_.]|$)/.test(record.name.split("/").pop() ?? "")) {
      record.category = { key: "market", label: "插件市场与管理", evidence: "aggregate" };
    }
  }

  for (const record of records) {
    delete record.rawDependencies;
  }

  const warnings = buildWarnings({ records, patch, nodeModuleNames: new Set(records.map((r) => r.name)), bundles, profileDir });

  const plugins = records.sort((a, b) => {
    const left = (a.displayNames[0] ?? a.name).toLowerCase();
    const right = (b.displayNames[0] ?? b.name).toLowerCase();
    return left.localeCompare(right, "zh-Hans-CN");
  });

  const snapshot = {
    schema: 1,
    generatedAt: new Date().toISOString(),
    scanMs: Date.now() - startedAt,
    dshHome: resolveDshHome(profileDir),
    profileName: currentProfileName(profileDir),
    profileDir,
    hostVersion: readHostVersion(),
    profiles: listProfiles(profileDir),
    counts: {
      total: plugins.length,
      declared: plugins.filter((p) => p.declared).length,
      loaded: plugins.filter((p) => p.inBundles).length,
      disabled: plugins.filter((p) => p.enabled === false).length,
      notLoaded: plugins.filter((p) => !p.inBundles && p.mountedBy === null).length,
      warnings: warnings.filter((w) => w.severity !== "info").length,
      families: families.length,
    },
    families,
    plugins,
    warnings,
    changes: diffWithPrevious(previous, plugins),
    manifestError,
    patchOk: patch.ok,
    patchEntries: patch.entries.length,
  };
  return snapshot;
}

/**
 * List candidate plugin directories under `node_modules`.
 * @param {string} profileDir - absolute profile directory.
 * @returns {string[]} package names relative to node_modules.
 */
function listPluginDirs(profileDir) {
  const root = join(profileDir, "node_modules");
  let names = [];
  try {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      if (entry.name.startsWith("@")) {
        let scoped = [];
        try {
          scoped = readdirSync(join(root, entry.name), { withFileTypes: true })
            .filter((child) => child.isDirectory())
            .map((child) => `${entry.name}/${child.name}`);
        } catch {
          scoped = [];
        }
        names.push(...scoped);
      } else {
        names.push(entry.name);
      }
    }
  } catch {
    return [];
  }
  return names;
}

/**
 * Read one package into a record, or null when it is not a DSH plugin.
 * @param {string} profileDir - absolute profile directory.
 * @param {string} name - package name.
 * @returns {Promise<object|null>} record.
 */
async function readPackage(profileDir, name) {
  if (HOST_SCOPES.some((scope) => name.startsWith(scope))) return null;
  const dir = join(profileDir, "node_modules", ...name.split("/"));
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  } catch {
    return null;
  }
  if (!looksLikePlugin(name, manifest)) return null;

  const naming = resolveDisplayNames(dir, manifest, name);
  const surfaces = detectSurfaces(dir, manifest);
  const repo = readRepo(manifest);
  return {
    name,
    version: typeof manifest.version === "string" ? manifest.version : "",
    displayNames: naming.names,
    displayNameSource: naming.source,
    repo,
    description: typeof manifest.description === "string" ? manifest.description : "",
    author: authorOf(name, repo),
    dir,
    installed: true,
    enginesDsh: manifest?.engines?.dsh ?? null,
    ui: surfaces.ui,
    surfaces: surfaces.surfaces,
    entries: surfaces.entries,
    tools: surfaces.tools,
    command: surfaces.command,
    route: surfaces.route,
    risk: surfaces.risk,
    category: surfaces.category,
    ...readTimes(dir),
    rawDependencies: manifest.dependencies ?? {},
  };
}

/**
 * A package is inventoried when it declares a `dsh` block, carries the plugin
 * keyword, or uses a plugin-shaped name. Pure npm libraries are excluded.
 * @param {string} name - package name.
 * @param {object} manifest - parsed package.json.
 * @returns {boolean} true when the package should appear in the inventory.
 */
function looksLikePlugin(name, manifest) {
  if (manifest !== null && typeof manifest === "object" && manifest.dsh !== undefined) return true;
  if (Array.isArray(manifest?.keywords) && manifest.keywords.includes("dsh-plugin")) return true;
  return /(^|\/)(dsh|dshm)[-_]|dsh-plugin/i.test(name);
}

/**
 * Compute effective enablement from patch rows.
 * @param {{disabled:boolean}[]} entries - patch rows for this package.
 * @returns {boolean|null} null when no row exists (loader default = enabled).
 */
function resolveEnabled(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  return !entries[entries.length - 1].disabled;
}

/**
 * Read `repository.url` from a manifest.
 * @param {object} manifest - parsed package.json.
 * @returns {string|null} raw url.
 */
function readRepo(manifest) {
  const repo = manifest?.repository;
  const url = typeof repo === "string" ? repo : repo?.url;
  return typeof url === "string" && url.trim() !== "" ? url.trim() : null;
}

/**
 * Derive a display author from scope or repository owner.
 * @param {string} name - package name.
 * @param {string|null} repo - repository url.
 * @returns {string} author label.
 */
function authorOf(name, repo) {
  const scope = /^@([^/]+)\//.exec(name);
  if (scope !== null) return `@${scope[1]}`;
  const owner = /github\.com[/:]([^/]+)\//i.exec(String(repo ?? ""));
  return owner === null ? "" : owner[1];
}

/**
 * Best-effort host version from the shipped runtime metadata.
 * @returns {string} version string, or "" when unknown.
 */
function readHostVersion() {
  const home = typeof process.env.DSH_HOME === "string" && process.env.DSH_HOME.trim() !== ""
    ? process.env.DSH_HOME.trim()
    : null;
  if (home === null) return "";
  try {
    const raw = readFileSync(join(home, "..", "resources", "runtime", "versions.json"), "utf8");
    const parsed = JSON.parse(raw);
    return typeof parsed?.dsh === "string" ? parsed.dsh : "";
  } catch {
    return "";
  }
}

/**
 * Directory timestamps in ISO form.
 *
 * `installedAt` is what the list column shows, so it prefers the directory's
 * creation time (Windows/macOS report a real birth time; `npm install` creates
 * the package folder, which makes it the honest "when did this arrive" value).
 * Filesystems that report a zero birth time fall back to mtime — never to
 * "now", which would make an old install look brand new.
 *
 * @param {string} path - absolute package directory.
 * @returns {{mtime:string, installedAt:string}} ISO timestamps, "" when unreadable.
 */
function readTimes(path) {
  try {
    const info = statSync(path, { bigint: false });
    const mtime = new Date(info.mtimeMs).toISOString();
    const born = info.birthtimeMs;
    const installedAt = typeof born === "number" && born > 0 ? new Date(born).toISOString() : mtime;
    return { mtime, installedAt };
  } catch {
    return { mtime: "", installedAt: "" };
  }
}

/**
 * Compare the new plugin set with the previous snapshot so the panel can say
 * "2 new packages since you last looked" — the incremental-sync signal a user
 * needs right after `dsh plugin add`.
 * @param {object|null} previous - last snapshot.
 * @param {object[]} plugins - current records.
 * @returns {{added:string[], removed:string[], at:string|null}} change set.
 */
function diffWithPrevious(previous, plugins) {
  const current = new Set(plugins.map((plugin) => plugin.name));
  const before = new Set(Array.isArray(previous?.plugins) ? previous.plugins.map((plugin) => plugin.name) : []);
  if (before.size === 0) return { added: [], removed: [], at: previous?.generatedAt ?? null };
  return {
    added: [...current].filter((name) => !before.has(name)),
    removed: [...before].filter((name) => !current.has(name)),
    at: previous?.generatedAt ?? null,
  };
}
