/**
 * Authenticated read-only routes.
 *
 * All routes live under `/api`, so the connection service has already applied
 * its Host/Origin fence and session check before any handler runs. Nothing here
 * accepts a filesystem path from the caller: `detail` only answers for names
 * that exist in the snapshot, which keeps the endpoint from becoming an
 * arbitrary file reader.
 *
 * @module dsh-installed-inventory/routes
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { toCsv, toMarkdown } from "./exporter.js";
import { SLOT_GROUPS } from "./surfaces.js";

const BASE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

/**
 * Register every inventory route.
 * @param {object} ctx - host context carrying `connection`.
 * @param {{routeRoot:string}} settings - resolved settings.
 * @param {object} inventory - service created by `createInventory`.
 * @returns {() => void} disposer.
 */
export function registerRoutes(ctx, settings, inventory) {
  const disposers = [];

  disposers.push(
    ctx.connection.fetch.register({
      path: `${settings.routeRoot}/snapshot`,
      methods: ["GET"],
      requestBody: "buffered",
      fetch: async (request) => {
        const query = queryOf(request);
        try {
          const snapshot = await inventory.snapshot({
            profile: query.get("profile") ?? undefined,
            refresh: query.get("refresh") === "1",
          });
          return json(200, { ok: true, snapshot });
        } catch (error) {
          return json(500, { ok: false, error: { code: "E_SCAN_FAILED", message: messageOf(error) } });
        }
      },
    })
  );

  disposers.push(
    ctx.connection.fetch.register({
      path: `${settings.routeRoot}/revision`,
      methods: ["GET"],
      requestBody: "buffered",
      fetch: async () => json(200, { ok: true, ...inventory.revision() }),
    })
  );

  disposers.push(
    ctx.connection.fetch.register({
      path: `${settings.routeRoot}/detail`,
      methods: ["GET"],
      requestBody: "buffered",
      fetch: async (request) => {
        const query = queryOf(request);
        const name = query.get("name") ?? "";
        try {
          const snapshot = await inventory.snapshot({ profile: query.get("profile") ?? undefined });
          const plugin = snapshot.plugins.find((entry) => entry.name === name);
          if (plugin === undefined) {
            return json(404, { ok: false, error: { code: "E_UNKNOWN_PLUGIN", message: `未在清单中找到 ${name}` } });
          }
          return json(200, {
            ok: true,
            plugin: { ...plugin, sizeBytes: dirSize(plugin.dir) },
            matrix: buildMatrix(plugin),
            entries: buildEntries(plugin),
            patchSnippets: readPatchSnippets(snapshot.profileDir, plugin.patchEntries ?? []),
          });
        } catch (error) {
          return json(500, { ok: false, error: { code: "E_SCAN_FAILED", message: messageOf(error) } });
        }
      },
    })
  );

  disposers.push(
    ctx.connection.fetch.register({
      path: `${settings.routeRoot}/export`,
      methods: ["GET"],
      requestBody: "buffered",
      fetch: async (request) => {
        const query = queryOf(request);
        try {
          const snapshot = await inventory.snapshot({ profile: query.get("profile") ?? undefined });
          const format = query.get("format") === "csv" ? "csv" : "md";
          const body = format === "csv" ? toCsv(snapshot) : toMarkdown(snapshot);
          return new Response(body, {
            status: 200,
            headers: {
              ...BASE_HEADERS,
              "Content-Type": format === "csv" ? "text/csv; charset=utf-8" : "text/markdown; charset=utf-8",
              "Content-Disposition": `attachment; filename="dsh-plugins-${snapshot.profileName}.${format}"`,
            },
          });
        } catch (error) {
          return json(500, { ok: false, error: { code: "E_SCAN_FAILED", message: messageOf(error) } });
        }
      },
    })
  );

  return () => {
    for (const dispose of disposers) dispose();
  };
}

/**
 * Join one plugin's registrations to the human name of the region they occupy.
 *
 * A plugin draws in up to a dozen places; the matrix answers "which kinds", and
 * this answers "which ones, and what did it call them". Each row is what the
 * detail panel lists under 入口位置.
 *
 * @param {object} plugin - inventory record.
 * @returns {{slot:string,group:string,groupLabel:string,name:string}[]} rows.
 */
export function buildEntries(plugin) {
  const rows = [];
  for (const group of SLOT_GROUPS) {
    const slots = plugin.surfaces?.[group.key] ?? [];
    for (const slot of slots) {
      // `inject:<service>` means the bundle declares a dependency on that part
      // of the host, not that it draws anything there. Listing it as an entry
      // made every plugin that touches the sidebar look like it owns a tab.
      if (slot.startsWith("inject:")) continue;
      const named = (plugin.entries ?? []).filter((entry) => entry.slot === slot);
      if (named.length === 0) rows.push({ slot, group: group.key, groupLabel: group.label, name: "" });
      for (const entry of named) {
        rows.push({ slot, group: group.key, groupLabel: group.label, name: entry.name });
      }
    }
  }
  return rows;
}

/**
 * Turn one record into the detail-page capability matrix.
 * @param {object} plugin - inventory record.
 * @returns {{key:string,label:string,present:boolean,evidence:string,risk:boolean}[]} matrix rows.
 */
export function buildMatrix(plugin) {
  const rows = [{ key: "ui", label: "界面 (client bundle)", present: plugin.ui === true, evidence: plugin.ui ? "exports[\"./client\"]" : "", risk: false }];
  for (const group of SLOT_GROUPS) {
    const hits = plugin.surfaces?.[group.key] ?? [];
    const literal = hits.filter((slot) => !slot.startsWith("inject:"));
    rows.push({
      key: group.key,
      label: group.label,
      present: hits.length > 0,
      // Present through a service dependency only: likely, not proven.
      weak: literal.length === 0 && hits.length > 0,
      evidence: literal[0] ?? hits[0] ?? "",
      risk: false,
    });
  }
  rows.push(
    { key: "tools", label: "Agent 工具", present: plugin.tools === true, evidence: plugin.tools ? "tools.register" : "", risk: false },
    { key: "command", label: "命令", present: plugin.command === true, evidence: plugin.command ? "commands.register" : "", risk: false },
    { key: "route", label: "后台路由", present: plugin.route === true, evidence: plugin.route ? "connection.fetch.register" : "", risk: false }
  );
  const risk = plugin.risk ?? [];
  rows.push(
    { key: "risk-shell", label: "执行系统命令", present: risk.includes("shell"), evidence: risk.includes("shell") ? "child_process" : "", risk: true },
    { key: "risk-fs", label: "写文件", present: risk.includes("fs"), evidence: risk.includes("fs") ? "writeFile" : "", risk: true },
    { key: "risk-net", label: "出网", present: risk.includes("net"), evidence: risk.includes("net") ? "fetch" : "", risk: true }
  );
  return rows;
}

/**
 * Read ±3 lines around each patch row so the drawer can show real context.
 * @param {string} profileDir - absolute profile directory.
 * @param {{line:number,id:string}[]} entries - patch rows for the package.
 * @returns {{id:string,line:number,text:string}[]} snippets.
 */
function readPatchSnippets(profileDir, entries) {
  if (entries.length === 0) return [];
  let lines = [];
  try {
    lines = readFileSync(join(profileDir, "cordis.patch.yml"), "utf8").split(/\r?\n/);
  } catch {
    return [];
  }
  return entries.slice(0, 3).map((entry) => {
    const start = Math.max(0, entry.line - 4);
    const end = Math.min(lines.length, entry.line + 3);
    return { id: entry.id, line: entry.line, text: lines.slice(start, end).join("\n") };
  });
}

/**
 * Bounded recursive size, so a pathological package cannot stall a request.
 * @param {string} dir - absolute package directory.
 * @returns {number} byte count.
 */
function dirSize(dir) {
  const budget = { files: 4000, bytes: 0 };
  walk(dir, budget, 0);
  return budget.bytes;
}

/**
 * Depth-limited walk used by `dirSize`.
 * @param {string} dir - directory to walk.
 * @param {{files:number,bytes:number}} budget - shared counters.
 * @param {number} depth - current depth.
 * @returns {void}
 */
function walk(dir, budget, depth) {
  if (depth > 6 || budget.files <= 0) return;
  let entries = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (budget.files <= 0) return;
    const target = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      walk(target, budget, depth + 1);
    } else {
      try {
        budget.bytes += statSync(target).size;
      } catch {
        // Unreadable file: skip.
      }
      budget.files -= 1;
    }
  }
}

/**
 * Read query parameters from either a Request or a bare URL string.
 * @param {unknown} request - handler argument.
 * @returns {URLSearchParams} parsed query.
 */
function queryOf(request) {
  const raw = typeof request === "string" ? request : request?.url;
  if (typeof raw !== "string" || raw === "") return new URLSearchParams();
  try {
    return new URL(raw, "http://localhost").searchParams;
  } catch {
    return new URLSearchParams();
  }
}

/**
 * One JSON answer with the shared headers.
 * @param {number} status - HTTP status.
 * @param {object} body - payload.
 * @returns {Response} response.
 */
function json(status, body) {
  const text = JSON.stringify(body);
  return new Response(text, {
    status,
    headers: {
      ...BASE_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": String(Buffer.byteLength(text)),
    },
  });
}

/**
 * Normalise an unknown error into a message.
 * @param {unknown} error - thrown value.
 * @returns {string} message.
 */
function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}
