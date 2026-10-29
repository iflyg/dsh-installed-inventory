/**
 * Family (author / repo / prefix) grouping.
 *
 * Two plugin "families" look completely different in the installed tree:
 *
 *   @linxin666/*            12 packages, ONE repository (zhu1090093659/dsh-web)
 *   dsh-plugin-wallpaper-*   7 packages, no repository declared at all
 *   @michengai/*            12 packages, 12 separate repositories
 *
 * A single signal would split or over-merge them, so families are built by
 * union-find over three relations: shared npm scope, shared repository, shared
 * multi-segment name stem. The stem rule deliberately requires at least three
 * segments before collapsing, otherwise every `dsh-*` package would merge into
 * one giant family.
 *
 * @module dsh-installed-inventory/family
 */

/**
 * Build family assignments for a set of packages.
 * @param {{name:string, repo:string|null, description?:string, dependencies?:Record<string,string>}[]} packages - scanned records.
 * @returns {{families:{key:string,label:string,aggregate:string|null,members:string[]}[], byName:Record<string,{key:string,label:string,isAggregate:boolean}>}}
 */
export function buildFamilies(packages) {
  const index = new Map();
  packages.forEach((pkg, i) => index.set(pkg.name, i));

  const parent = packages.map((_, i) => i);
  const find = (i) => {
    let root = i;
    while (parent[root] !== root) root = parent[root];
    while (parent[i] !== root) {
      const next = parent[i];
      parent[i] = root;
      i = next;
    }
    return root;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  const buckets = { scope: new Map(), repo: new Map(), stem: new Map() };
  packages.forEach((pkg, i) => {
    const scope = scopeOf(pkg.name);
    if (scope !== null) push(buckets.scope, scope, i);
    const repo = normalizeRepo(pkg.repo);
    if (repo !== null) push(buckets.repo, repo, i);
    const stem = stemOf(pkg.name);
    if (stem !== null) push(buckets.stem, stem, i);
  });

  for (const bucket of Object.values(buckets)) {
    for (const members of bucket.values()) {
      for (let i = 1; i < members.length; i += 1) union(members[0], members[i]);
    }
  }

  const groups = new Map();
  packages.forEach((pkg, i) => {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(pkg);
  });

  const families = [];
  const byName = {};
  for (const members of groups.values()) {
    const identity = familyIdentity(members);
    const label = identity.label;
    const key = label;
    const aggregate = members.find((pkg) => isAggregate(pkg, index))?.name ?? null;
    const entry = { key, label, author: identity.author, aggregate, members: members.map((pkg) => pkg.name).sort() };
    families.push(entry);
    for (const pkg of members) {
      byName[pkg.name] = { key, label, author: identity.author, isAggregate: pkg.name === aggregate };
    }
  }

  families.sort((a, b) => {
    if (b.members.length !== a.members.length) return b.members.length - a.members.length;
    return a.label.localeCompare(b.label, "zh-Hans-CN");
  });

  return { families, byName };
}

/**
 * Read the npm scope of a package name.
 * @param {string} name - package name.
 * @returns {string|null} `@scope` or null for unscoped packages.
 */
export function scopeOf(name) {
  const match = /^(@[^/]+)\//.exec(String(name));
  return match === null ? null : match[1];
}

/**
 * Normalise a repository URL to `owner/repo`.
 * @param {string|null} repo - raw repository url.
 * @returns {string|null} `owner/repo`, or null when absent.
 */
export function normalizeRepo(repo) {
  if (typeof repo !== "string" || repo.trim() === "") return null;
  const cleaned = repo
    .replace(/^git\+/, "")
    .replace(/^git@github\.com:/, "https://github.com/")
    .replace(/\.git$/, "")
    .replace(/\/+$/, "");
  const match = /github\.com[/:]([^/]+)\/([^/]+)/i.exec(cleaned);
  if (match !== null) return `${match[1].toLowerCase()}/${match[2].toLowerCase()}`;
  return cleaned.toLowerCase();
}

/**
 * Extract a multi-segment family stem, e.g. `dsh-plugin-wallpaper-engine-fx`
 * becomes `wallpaper-engine`. Single-segment names yield null so unrelated
 * packages never merge by prefix.
 * @param {string} name - package name.
 * @returns {string|null} stem, or null.
 */
export function stemOf(name) {
  const bare = String(name).replace(/^@[^/]+\//, "").replace(/^dsh-/, "").replace(/^plugin-/, "");
  const segments = bare.split("-").filter(Boolean);
  if (segments.length < 2) return null;
  // `wallpaper-engine` + `wallpaper-engine-fx` must land on the same stem, so a
  // long name truncates to two segments while a two-segment name is its own stem.
  return segments.length >= 3 ? `${segments[0]}-${segments[1]}` : bare;
}

/**
 * Pick a human label — and, separately, the author to show as the group title.
 *
 * The list groups by author, because that is what a user recognises in a
 * package list: `@linxin666/dsh-web-all` is one publisher's suite, and its
 * member `@linxin666/dsh-client-ui-browser-view` should sit under `@linxin666`,
 * not under a repository slug or a filename stem.
 *
 * @param {object[]} members - member packages.
 * @returns {{author:string,label:string}} author (may be empty) and group label.
 */
function familyIdentity(members) {
  const scopes = members.map((pkg) => scopeOf(pkg.name));
  const uniqueScopes = [...new Set(scopes.filter((scope) => scope !== null))];
  // One publisher scope is the most recognisable label: @michengai's packages
  // each live in their own repository, so a repo name would mislead.
  if (uniqueScopes.length === 1 && scopes.every((scope) => scope !== null)) {
    return { author: uniqueScopes[0], label: uniqueScopes[0] };
  }

  const repos = [...new Set(members.map((pkg) => normalizeRepo(pkg.repo)).filter((repo) => repo !== null))];
  const owners = [...new Set(repos.map((repo) => repo.split("/")[0]))];
  if (repos.length > 0) {
    return { author: owners.length === 1 ? owners[0] : "", label: repos[0] };
  }

  if (uniqueScopes.length > 0) return { author: uniqueScopes[0], label: uniqueScopes[0] };
  const stems = members.map((pkg) => stemOf(pkg.name)).filter((stem) => stem !== null);
  if (stems.length > 0) return { author: "", label: stems[0] };
  return { author: "", label: String(members[0].name) };
}

/**
 * A package is an aggregate when it pulls in siblings, or says so in its name.
 * @param {object} pkg - candidate package.
 * @param {Map<string,number>} index - names of every recorded package.
 * @returns {boolean} true when the package looks like a family bundle.
 */
export function isAggregate(pkg, index) {
  const deps = Object.keys(pkg.dependencies ?? {});
  const siblings = deps.filter((dep) => index.has(dep) && dep !== pkg.name);
  if (siblings.length >= 2) return true;
  return /\b(all|suite|pack|bundle)\b|全家桶/i.test(String(pkg.name));
}

/**
 * Append a value to a bucket array.
 * @param {Map<string,number[]>} bucket - target map.
 * @param {string} key - bucket key.
 * @param {number} value - index to append.
 * @returns {void}
 */
function push(bucket, key, value) {
  const list = bucket.get(key);
  if (list === undefined) bucket.set(key, [value]);
  else list.push(value);
}
