/**
 * Audit rules.
 *
 * Every rule is a pure function of the scan result, so each one can be unit
 * tested against a synthetic profile. Severity matters: an override-style
 * duplicate id (a config row followed by a later `disabled: true` row) is how
 * users disable a plugin without deleting its config, and calling that an error
 * would train people to ignore the warning strip.
 *
 * @module dsh-installed-inventory/warnings
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Build the warning list for one snapshot.
 * @param {{records:object[], patch:{entries:object[],duplicates:string[],ok:boolean}, nodeModuleNames:Set<string>, bundles:string[], profileDir:string}} input - scan context.
 * @returns {object[]} warnings, most severe first.
 */
export function buildWarnings(input) {
  const warnings = [];
  const { records, patch, nodeModuleNames, profileDir } = input;
  const byName = new Map(records.map((record) => [record.name, record]));

  // --- duplicate patch ids -------------------------------------------------
  const entriesById = new Map();
  for (const entry of patch.entries) {
    const list = entriesById.get(entry.id) ?? [];
    list.push(entry);
    entriesById.set(entry.id, list);
  }
  for (const id of patch.duplicates) {
    const rows = entriesById.get(id) ?? [];
    const last = rows[rows.length - 1];
    const overrideStyle = last !== undefined && last.disabled === true && last.hasConfig === false;
    const target = rows.find((entry) => entry.name !== "")?.name ?? "";
    warnings.push({
      code: "DUP_ID",
      severity: overrideStyle ? "info" : "warn",
      plugin: target,
      detail: overrideStyle
        ? `id \`${id}\` 出现 ${rows.length} 次，最后一条为 disabled:true（覆盖式停用）`
        : `id \`${id}\` 出现 ${rows.length} 次且存在多条 config，后者会覆盖前者`,
      where: { file: "cordis.patch.yml", line: rows[0].line },
    });
  }

  // --- patch rows pointing at packages that are gone -----------------------
  for (const entry of patch.entries) {
    if (entry.name === "") continue;
    // `@deepseek-ai/*` ships inside the app bundle, never in the profile, so it
    // is present without appearing in node_modules.
    if (entry.name.startsWith("@deepseek-ai/")) continue;
    if (nodeModuleNames.has(entry.name)) continue;
    // Patch names may target a subpath (`pkg/remote`); the base package is what
    // has to exist.
    if (nodeModuleNames.has(basePackageOf(entry.name))) continue;
    warnings.push({
      code: "ZOMBIE_ENTRY",
      severity: "warn",
      plugin: entry.name,
      detail: `patch 条目 \`${entry.id}\` 引用的包不在 node_modules 中${entry.disabled ? "（已停用的残留）" : ""}`,
      where: { file: "cordis.patch.yml", line: entry.line },
    });
  }

  // --- installed but never loaded -----------------------------------------
  for (const record of records) {
    if (!record.declared || record.inBundles || record.mountedBy !== null) continue;
    const aggregate = record.family?.isAggregate === true;
    warnings.push({
      code: "NOT_LOADED",
      severity: aggregate ? "info" : "warn",
      plugin: record.name,
      detail: aggregate
        ? "家族聚合包未被 bundles 登记，其子包不会加载"
        : "已在 dependencies 中，但不在 dsh.profile.bundles，宿主不会加载它",
      where: { file: "package.json", line: 0 },
    });
  }

  // --- missing repository --------------------------------------------------
  for (const record of records) {
    if (record.repo !== null) continue;
    warnings.push({
      code: "NO_REPO",
      severity: "info",
      plugin: record.name,
      detail: "package.json 未声明 repository，无法定位源码",
      where: null,
    });
  }

  // --- declared range vs installed version --------------------------------
  for (const record of records) {
    const declared = record.declaredVersion;
    if (declared === "" || record.version === "") continue;
    if (/^(workspace:|file:|link:|npm:|git\+|https?:)/.test(declared)) continue;
    if (!satisfies(record.version, declared)) {
      warnings.push({
        code: "VERSION_DRIFT",
        severity: "warn",
        plugin: record.name,
        detail: `声明 \`${declared}\`，实际安装 ${record.version}`,
        where: { file: "package.json", line: 0 },
      });
    }
  }

  // --- patch backups piling up --------------------------------------------
  const backups = countPatchBackups(profileDir);
  if (backups > 1) {
    warnings.push({
      code: "BACKUP_RESIDUE",
      severity: "info",
      plugin: "",
      detail: `cordis.patch.yml 存在 ${backups - 1} 个备份文件（.bak-* / .yml--），可清理`,
      where: { file: "cordis.patch.yml", line: 0 },
    });
  }

  if (patch.ok === false) {
    warnings.push({
      code: "PATCH_UNPARSEABLE",
      severity: "info",
      plugin: "",
      detail: "cordis.patch.yml 未能解析出任何条目，patch 相关列已置空",
      where: { file: "cordis.patch.yml", line: 0 },
    });
  }

  void byName;
  const order = { warn: 0, info: 1 };
  return warnings.sort((a, b) => {
    const delta = (order[a.severity] ?? 2) - (order[b.severity] ?? 2);
    if (delta !== 0) return delta;
    return a.code.localeCompare(b.code);
  });
}

/**
 * Strip a subpath from a package specifier.
 * @param {string} name - `@scope/pkg/sub` or `pkg/sub`.
 * @returns {string} `@scope/pkg` or `pkg`.
 */
function basePackageOf(name) {
  const parts = String(name).split("/");
  return name.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

/**
 * Count `cordis.patch.yml*` siblings, including backups.
 * @param {string} profileDir - absolute profile directory.
 * @returns {number} file count.
 */
function countPatchBackups(profileDir) {
  try {
    return readdirSync(profileDir).filter((name) => name.startsWith("cordis.patch.yml")).length;
  } catch {
    return 0;
  }
}

/**
 * Minimal semver range check: enough for `^`, `~` and exact pins, which is all
 * a profile manifest uses in practice.
 * @param {string} version - installed version.
 * @param {string} range - declared range.
 * @returns {boolean} true when the range accepts the version.
 */
export function satisfies(version, range) {
  const actual = parseSemver(version);
  const text = String(range).trim();
  if (actual === null) return true;

  if (text.startsWith("^") || text.startsWith("~")) {
    const base = parseSemver(text.slice(1));
    if (base === null) return true;
    const cmp = compare(actual, base);
    if (cmp < 0) return false;
    if (text.startsWith("~")) return actual.major === base.major && actual.minor === base.minor;
    if (base.major > 0) return actual.major === base.major;
    if (base.minor > 0) return actual.major === 0 && actual.minor === base.minor;
    return actual.major === 0 && actual.minor === 0 && actual.patch === base.patch;
  }

  if (/^[0-9]+\.[0-9]+\.[0-9]+/.test(text)) {
    const base = parseSemver(text);
    return base !== null && compare(actual, base) === 0;
  }

  return true;
}

/**
 * Parse `x.y.z(-tag)` into numbers.
 * @param {string} value - version string.
 * @returns {{major:number,minor:number,patch:number}|null} parts.
 */
function parseSemver(value) {
  const match = /^[v=\s]*(\d+)\.(\d+)\.(\d+)/.exec(String(value).trim());
  if (match === null) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

/**
 * Compare two parsed versions.
 * @param {{major:number,minor:number,patch:number}} a - left.
 * @param {{major:number,minor:number,patch:number}} b - right.
 * @returns {number} -1 / 0 / 1.
 */
function compare(a, b) {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
  return 0;
}
