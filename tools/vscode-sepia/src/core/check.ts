// `sepia check`: every rule a person or an agent can break by editing the
// files. Pure: a Project in, Problems out. The extension shows them in the
// Problems panel, the CLI prints them (JSON for agents).

import { buildIndex, resolvePart, splitPiece, splitTerminal } from "./model.ts";
import { conductors, numberedWires } from "./conductors.ts";
import { isGenerated } from "./generated.ts";
import { DEFAULT_COLS, sheetKind, SYMBOLS } from "./symbols.ts";
import type { Problem, Project } from "./types.ts";

export function check(p: Project): Problem[] {
  const out: Problem[] = [];
  const add = (severity: Problem["severity"], file: string, code: string, message: string, find?: string) =>
    out.push({ severity, file, code, message, find });

  for (const [file, msg] of Object.entries(p.parseErrors)) add("error", file, "parse", `doesn't parse: ${msg}`);

  const ix = buildIndex(p);

  // Devices
  const seen = new Set<string>();
  for (const d of p.panel.devices ?? []) {
    if (!d?.tag) {
      add("error", "panel.json", "device-tag", "a device has no tag");
      continue;
    }
    if (seen.has(d.tag)) add("error", "panel.json", "device-dup", `device ${d.tag} is listed twice`, `"${d.tag}"`);
    seen.add(d.tag);
    if (!p.parts[d.part]) add("error", "panel.json", "part-unknown", `${d.tag}: part "${d.part}" isn't in parts/`, `"${d.part}"`);
  }

  // Assemblies
  for (const [id, part] of Object.entries(p.parts)) {
    const file = `parts/${id}.json`;
    if (part.base && !p.parts[part.base]) add("error", file, "part-base", `base part "${part.base}" isn't in parts/`, `"${part.base}"`);
    for (const b of part.bom ?? [])
      if (!p.parts[b.part]) add("warning", file, "bom-part", `bill of materials names "${b.part}", which isn't in parts/`, `"${b.part}"`);
  }

  // Wires
  const wireNos = new Set<string>();
  const termWire = new Map<string, string>();
  const railWires = new Set(p.sheets.flatMap((s) => s.sheet.rails ?? []));
  for (const w of p.panel.wires ?? []) {
    if (!w?.no) {
      add("error", "panel.json", "wire-no", "a wire has no number");
      continue;
    }
    const at = `"no": "${w.no}"`;
    if (wireNos.has(w.no)) add("error", "panel.json", "wire-dup", `wire ${w.no} is listed twice; one number is one potential`, at);
    wireNos.add(w.no);
    if (w.class && !p.sepia.wireClasses?.[w.class])
      add("warning", "panel.json", "wire-class", `wire ${w.no}: class "${w.class}" isn't in sepia.json wireClasses`, at);
    const run = w.run ?? [];
    if (run.length < 2 && !railWires.has(w.no))
      add("warning", "panel.json", "wire-open", `wire ${w.no} has ${run.length === 1 ? "one end" : "no ends"}`, at);
    for (const t of run) {
      const [tag, term] = splitTerminal(t);
      if (!term) add("error", "panel.json", "term-syntax", `wire ${w.no}: "${t}" should be TAG:TERMINAL`, `"${t}"`);
      else if (!ix.devices.has(tag)) add("error", "panel.json", "term-device", `wire ${w.no}: no device ${tag}`, `"${t}"`);
      else if (!ix.terminals.has(t)) {
        const part = ix.devices.get(tag)!.part;
        if (p.parts[part]) add("error", "panel.json", "term-unknown", `wire ${w.no}: ${part} has no terminal ${term}`, `"${t}"`);
      }
      const prev = termWire.get(t);
      if (prev && prev !== w.no)
        add("error", "panel.json", "term-two-wires", `${t} is on wires ${prev} and ${w.no}; a terminal is one potential`, `"${t}"`);
      termWire.set(t, w.no);
    }
  }

  // Sheets
  for (const s of p.sheets) {
    const file = `sheets/${s.file}`;
    const sh = s.sheet;
    if (isGenerated(sh.kind)) {
      if (sh.place?.length) add("warning", file, "sheet-generated", `a ${sh.kind} sheet is generated from the data; its "place" list is ignored`, `"place"`);
      continue;
    }
    const kind = sheetKind(sh.kind);
    if (!kind) add("info", file, "sheet-kind", `sheet kind "${sh.kind}" isn't drawn yet`);
    const cols = sh.cols ?? DEFAULT_COLS[kind ?? "ladder"];
    const [lo, hi] = sh.lines ?? [0, 0];
    for (const r of sh.rails ?? []) if (!ix.wires.has(r)) add("error", file, "rail-wire", `rail wire ${r} isn't in panel.json`, `"${r}"`);
    const cells = new Map<string, string>();
    for (const pl of sh.place ?? []) {
      const at = `"${pl.piece}"`;
      const info = ix.pieces.get(pl.piece);
      if (!info) {
        const [tag, name] = splitPiece(pl.piece);
        const why = !ix.devices.has(tag) ? `no device ${tag}` : `${ix.devices.get(tag)!.part} has no piece "${name}"`;
        add("error", file, "piece-unknown", `${pl.piece}: ${why}`, at);
      } else {
        const g = SYMBOLS[info.def.symbol];
        if (!g) add("error", file, "symbol-unknown", `${pl.piece}: symbol ${info.def.symbol} isn't built in`, at);
        else if (kind && !g.kinds.includes(kind))
          add("error", file, "symbol-kind", `${pl.piece}: ${info.def.symbol} goes on a ${g.kinds.join(" or ")} sheet, not a ${kind} sheet`, at);
      }
      if (sh.lines && (pl.line < lo || pl.line > hi)) add("error", file, "line-range", `${pl.piece}: line ${pl.line} is outside ${lo}–${hi}`, at);
      if (!(pl.col >= 1 && pl.col <= cols)) add("error", file, "col-range", `${pl.piece}: column ${pl.col} is outside 1–${cols}`, at);
      const cell = `${pl.line}/${pl.col}`;
      const other = cells.get(cell);
      if (other) add("error", file, "cell-taken", `${pl.piece} and ${other} are both at line ${pl.line}, column ${pl.col}`, at);
      cells.set(cell, pl.piece);
    }
  }
  for (const [ref, list] of ix.placed) {
    if (list.length > 1)
      add("warning", `sheets/${p.sheets.find((s) => s.name === list[1].sheet)?.file ?? ""}`, "piece-twice",
        `${ref} is drawn ${list.length} times (lines ${list.map((l) => l.line).join(", ")})`, `"${ref}"`);
  }

  // Wire ends nobody drew: fine while drafting, worth knowing.
  for (const w of p.panel.wires ?? []) {
    for (const t of w.run ?? []) {
      const info = ix.terminals.get(t);
      if (info && !ix.placed.has(info.piece.ref))
        add("info", "panel.json", "term-undrawn", `wire ${w.no}: ${t} (${info.piece.ref}) isn't on any sheet`, `"${t}"`);
    }
  }

  checkLineNumbers(p, ix, add);
  checkSccr(p, add);
  return out;
}

/** The panel's SCCR is its weakest rated device's (a simplification of
 * UL 508A SB4, which also lets current-limiting fuses raise it). Field
 * devices aren't in the panel. */
export function lowestSccr(p: Project): { ka: number; tags: string[]; part: string } | undefined {
  let lowest: { ka: number; tags: string[]; part: string } | undefined;
  for (const d of p.panel.devices ?? []) {
    if (d.field) continue;
    const sccr = (resolvePart(p.parts, d.part)?.ratings as { sccr?: { ka?: number | null }[] } | undefined)?.sccr;
    const ka = Math.min(...(sccr ?? []).map((r) => r.ka ?? Infinity));
    if (!isFinite(ka)) continue;
    if (!lowest || ka < lowest.ka) lowest = { ka, tags: [d.tag], part: d.part };
    else if (ka === lowest.ka) lowest.tags.push(d.tag);
  }
  return lowest;
}

/** Panel SCCR against the available fault current (parts.md assumption 1).
 * The fault current comes from the service transformer in sepia.json; the
 * cable between it and the panel only lowers it, so ignoring it is
 * conservative. */
function checkSccr(p: Project, add: (s: Problem["severity"], f: string, c: string, m: string, find?: string) => void) {
  const svc = p.sepia.service as { volts?: number; transformerKva?: number; transformerZPct?: number } | undefined;
  if (!svc?.volts || !svc.transformerKva || !svc.transformerZPct) return;
  const availKa = (svc.transformerKva * 1000) / (Math.sqrt(3) * svc.volts) / (svc.transformerZPct / 100) / 1000;
  const lowest = lowestSccr(p);
  if (!lowest) return;
  const math = `${svc.transformerKva} kVA ÷ (√3 × ${svc.volts} V) ÷ ${svc.transformerZPct} %Z = ${availKa.toFixed(1)} kA`;
  if (lowest.ka < availKa)
    add("error", "sepia.json", "sccr",
      `panel SCCR ${lowest.ka} kA (${lowest.tags.join(", ")}: ${lowest.part}) is below the available fault current: ${math}`, `"service"`);
}

/** `numbering.default: "line"` (docs/design.md §3.1): a wire takes the
 * number of the line where it first appears, with a letter when that line
 * starts several (302, 302A, 302B). Power conductors add the phase to the
 * branch number (103L1, 103T1). Rails and names that don't start with a
 * number (+24, 0V, L1) are left alone. */
function checkLineNumbers(p: Project, ix: ReturnType<typeof buildIndex>, add: (s: Problem["severity"], f: string, c: string, m: string, find?: string) => void) {
  // Only wires with a line-numbered conductor print their number.
  const numbered = numberedWires(conductors(p, ix));
  const rails = new Set(p.sheets.flatMap((s) => s.sheet.rails ?? []));
  for (const w of p.panel.wires ?? []) {
    if (!w?.no || rails.has(w.no) || !numbered.has(w.no)) continue;
    const m = /^(\d+)(?:[A-Z]|[A-Z]\d)?$/.exec(w.no);
    if (!m) continue;
    const lines = (w.run ?? []).flatMap((t) => {
      const info = ix.terminals.get(t);
      return info ? (ix.placed.get(info.piece.ref) ?? []).map((a) => a.line) : [];
    });
    if (!lines.length) continue;
    const first = Math.min(...lines);
    if (Number(m[1]) !== first)
      add("warning", "panel.json", "wire-numbering", `wire ${w.no} starts on line ${first}, so line numbering makes it ${first}, ${first}A, ${first}B… (or ${first}L1… for power)`, `"no": "${w.no}"`);
  }
}
