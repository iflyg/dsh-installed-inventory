/**
 * `cordis.patch.yml` reader.
 *
 * This file is user-edited and can carry inlined prompts tens of kilobytes long
 * (this machine's copy is ~4000 lines with a 25 KB block scalar). A regex over
 * `name:` therefore reports agent names as plugins — the scanner below is
 * indentation-aware instead: it only accepts keys that sit exactly two spaces
 * under an entry's `- ` marker, and it skips block scalars wholesale.
 *
 * Entries may live at the document root or inside an `- insert:` list; both are
 * collected the same way, because both become Loader rows.
 *
 * @module dsh-installed-inventory/patch
 */

/** Keys we care about; everything else on an entry is ignored. */
const ENTRY_KEYS = new Set(["id", "name", "disabled", "config"]);

/**
 * Parse a patch document into Loader rows.
 * @param {string} text - raw file content.
 * @returns {{ok:boolean, entries:{id:string,name:string,line:number,disabled:boolean,hasConfig:boolean}[], duplicates:string[]}}
 */
export function parsePatch(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  const entries = [];
  let current = null;
  let blockScalarIndent = -1;
  let configIndent = -1;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineNo = index + 1;
    if (line.trim() === "") continue;

    const indent = line.length - line.trimStart().length;
    const trimmed = line.trim();

    // Inside a block scalar: only a non-empty line indented at or below the
    // owner's indent closes it.
    if (blockScalarIndent >= 0) {
      if (indent > blockScalarIndent) continue;
      blockScalarIndent = -1;
    }

    if (trimmed.startsWith("#")) continue;

    // Everything under an entry's `config:` is plugin-owned data. It can hold
    // arbitrary lists (`- id: <model>` inside `models:`) that look exactly like
    // Loader rows, so it is skipped rather than parsed.
    if (configIndent >= 0) {
      if (indent > configIndent) continue;
      configIndent = -1;
    }

    // A key whose value is `|`, `>` (with optional chomping) starts a block.
    // The owning entry stays open: keys after the block still belong to it.
    const blockMatch = /^([A-Za-z_][\w-]*):\s*[|>][+-]?$/.exec(trimmed);
    if (blockMatch !== null) {
      if (current !== null && indent === current.indent + 2 && blockMatch[1] === "config") {
        current.hasConfig = true;
      }
      blockScalarIndent = indent;
      continue;
    }

    const entryMatch = /^-\s+id:\s*(.+)$/.exec(trimmed);
    if (entryMatch !== null) {
      current = {
        id: unquote(entryMatch[1]),
        name: "",
        line: lineNo,
        disabled: false,
        hasConfig: false,
        indent,
      };
      entries.push(current);
      continue;
    }

    // Any other `- ` list item at or above the entry's indent closes the entry.
    if (trimmed.startsWith("-")) {
      current = null;
      continue;
    }

    if (current === null) continue;
    if (indent !== current.indent + 2) continue;

    const keyMatch = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(trimmed);
    if (keyMatch === null) continue;
    const key = keyMatch[1];
    if (!ENTRY_KEYS.has(key)) continue;
    const value = unquote(keyMatch[2]);
    if (key === "name") current.name = value;
    else if (key === "disabled") current.disabled = value === "true";
    else if (key === "config") {
      current.hasConfig = true;
      if (value === "") configIndent = indent;
    }
  }

  const seen = new Map();
  for (const entry of entries) {
    seen.set(entry.id, (seen.get(entry.id) ?? 0) + 1);
  }
  const duplicates = [...seen.entries()].filter(([, count]) => count > 1).map(([id]) => id);

  const ok = entries.length > 0 || /^\s*\[\s*\]\s*$/m.test(String(text ?? ""));

  return {
    ok,
    entries: entries.map(({ id, name, line, disabled, hasConfig }) => ({ id, name, line, disabled, hasConfig })),
    duplicates,
  };
}

/**
 * Strip one layer of matching quotes.
 * @param {string} value - raw scalar.
 * @returns {string} bare value.
 */
function unquote(value) {
  const text = String(value ?? "").trim();
  if (text.length >= 2 && ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'")))) {
    return text.slice(1, -1);
  }
  return text;
}
