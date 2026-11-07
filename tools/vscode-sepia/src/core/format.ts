// The canonical writer for sepia's JSON files: two-space indent, and any
// object or array that holds no nested objects goes on one line. So each
// device, wire and placement is one line, and moving a piece is a one-line
// diff.

type J = unknown;

function isFlat(v: J): boolean {
  if (Array.isArray(v)) return v.every((x) => x === null || typeof x !== "object" || (Array.isArray(x) && x.every(isPrim)));
  if (v && typeof v === "object") return Object.values(v).every((x) => isPrim(x) || (Array.isArray(x) && x.every(isPrim)));
  return true;
}

function isPrim(v: J): boolean {
  return v === null || typeof v !== "object";
}

function inline(v: J): string {
  if (Array.isArray(v)) return `[${v.map(inline).join(", ")}]`;
  if (v && typeof v === "object") {
    const e = Object.entries(v).filter(([, x]) => x !== undefined);
    return e.length ? `{ ${e.map(([k, x]) => `${JSON.stringify(k)}: ${inline(x)}`).join(", ")} }` : "{}";
  }
  return JSON.stringify(v);
}

function write(v: J, ind: string, top: boolean): string {
  if (!top && isFlat(v)) return inline(v);
  const next = ind + "  ";
  if (Array.isArray(v)) {
    if (!v.length) return "[]";
    return `[\n${v.map((x) => next + write(x, next, false)).join(",\n")}\n${ind}]`;
  }
  if (v && typeof v === "object") {
    const e = Object.entries(v).filter(([, x]) => x !== undefined);
    if (!e.length) return "{}";
    return `{\n${e.map(([k, x]) => `${next}${JSON.stringify(k)}: ${write(x, next, false)}`).join(",\n")}\n${ind}}`;
  }
  return JSON.stringify(v);
}

export function formatJson(v: J): string {
  return write(v, "", true) + "\n";
}

/** The smallest single replacement turning `a` into `b`: offsets into `a`.
 * Keeps undo granular and leaves the rest of the document alone. */
export function minimalEdit(a: string, b: string): { start: number; end: number; text: string } | null {
  if (a === b) return null;
  let s = 0;
  while (s < a.length && s < b.length && a[s] === b[s]) s++;
  let ea = a.length, eb = b.length;
  while (ea > s && eb > s && a[ea - 1] === b[eb - 1]) { ea--; eb--; }
  return { start: s, end: ea, text: b.slice(s, eb) };
}
