/**
 * Configuration defaults and normalisation.
 *
 * A bundle patch replaces the whole `config` object, so every key needs a
 * code-side default here; a profile that overrides one key must not lose the
 * others.
 *
 * @module dsh-installed-inventory/config
 */

/** @type {{enabled:boolean, routeRoot:string, profileDir:string, standaloneSection:boolean, ttlSeconds:number}} */
export const DEFAULTS = {
  enabled: true,
  routeRoot: "/api/installed-inventory",
  profileDir: "",
  standaloneSection: false,
  ttlSeconds: 300,
};

/**
 * Normalise loader-supplied configuration.
 * @param {unknown} raw - loader config, possibly undefined.
 * @returns {typeof DEFAULTS} resolved settings.
 */
export function resolveConfig(raw) {
  const input = raw !== null && typeof raw === "object" ? raw : {};
  const routeRoot =
    typeof input.routeRoot === "string" && input.routeRoot.trim() !== ""
      ? input.routeRoot.trim().replace(/\/+$/, "")
      : DEFAULTS.routeRoot;
  const ttl = Number(input.ttlSeconds);
  return {
    enabled: input.enabled !== false,
    routeRoot: routeRoot.startsWith("/api/") ? routeRoot : DEFAULTS.routeRoot,
    profileDir: typeof input.profileDir === "string" ? input.profileDir.trim() : "",
    standaloneSection: input.standaloneSection === true,
    ttlSeconds: Number.isFinite(ttl) && ttl > 0 ? ttl : DEFAULTS.ttlSeconds,
  };
}
