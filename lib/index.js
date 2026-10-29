/**
 * dsh-installed-inventory — host half.
 *
 * Read-only on purpose: installation, removal and enable/disable stay on the
 * official Plugins page. This plugin answers "what is installed right now, what
 * is it called in the UI, and which surfaces does it take over".
 *
 * @module dsh-installed-inventory
 */
import { resolveConfig } from "./config.js";
import { resolveProfileDir } from "./profile.js";
import { registerRoutes } from "./routes.js";
import { createInventory } from "./service.js";

/** Plugin name, also the Loader id used by the bundle patch. */
export const name = "installed-inventory";

/** The authenticated `/api` fence is the only hard dependency. */
export const inject = ["connection"];

export { resolveConfig };

/**
 * Mount the inventory service and its routes.
 * @param {object} ctx - host context.
 * @param {object} config - loader configuration.
 * @returns {void}
 */
export function apply(ctx, config) {
  const settings = resolveConfig(config);
  if (!settings.enabled) return;

  const profileDir = resolveProfileDir(ctx, settings.profileDir);
  const inventory = createInventory({ profileDir, ttlSeconds: settings.ttlSeconds });

  ctx.effect(() => inventory.startWatching(), "installed-inventory: watch");
  ctx.effect(() => registerRoutes(ctx, settings, inventory), "installed-inventory: routes");

  // The browser learns its route root from the served page, so a configured
  // root and the client's URL can never drift apart.
  ctx.on("webserver/index-inject", (table) => {
    table.push({
      kind: "global",
      name: "__DSH_INSTALLED_INVENTORY__",
      value: { routeRoot: settings.routeRoot, standaloneSection: settings.standaloneSection },
    });
  });
}
