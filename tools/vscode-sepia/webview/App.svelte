<script lang="ts">
  import { onMount } from "svelte";
  import type { Problem, Project } from "../src/core/types.ts";
  import { buildIndex, otherEnds } from "../src/core/model.ts";
  import { layoutSheet } from "../src/core/ladder.ts";
  import { sheetKind, SYMBOLS } from "../src/core/symbols.ts";
  import { vscode } from "./vscodeApi.ts";
  import Sheet from "./Sheet.svelte";

  type Sel = { kind: "piece"; ref: string } | { kind: "wire"; no: string } | null;
  type Drag = { ref: string; symbol: string; n: number; text?: string; line: number; col: number; over: boolean; fromList: boolean; start?: { line: number; col: number } };

  let project = $state<Project | null>(null);
  let sheetName = $state("");
  let problems = $state<Problem[]>([]);
  let noProject = $state("");
  let selected = $state<Sel>(null);
  let drag = $state<Drag | null>(null);
  /** Optimistic placements until the host's next project message. */
  let pending: Record<string, { line: number; col: number } | null> = $state({});
  let sheetView: Sheet | undefined = $state();
  /** Side panels hidden (P), remembered across reloads of this panel. */
  let bare = $state(!!(vscode.getState?.() as { bare?: boolean } | undefined)?.bare);
  function toggleBare() {
    bare = !bare;
    vscode.setState?.({ bare });
    requestAnimationFrame(() => sheetView?.fit());
  }

  onMount(() => {
    const onMsg = (e: MessageEvent) => {
      const m = e.data;
      if (m?.type === "project") {
        project = m.project;
        sheetName = m.sheet;
        problems = m.problems;
        pending = {};
        noProject = "";
      } else if (m?.type === "noProject") noProject = m.file;
    };
    window.addEventListener("message", onMsg);
    if (window.__SEPIA__) onMsg({ data: window.__SEPIA__ } as MessageEvent);
    vscode.postMessage({ type: "ready" });
    return () => window.removeEventListener("message", onMsg);
  });

  const sheetIdx = $derived(project ? project.sheets.findIndex((s) => s.name === sheetName) : -1);
  // The project as drawn: the pending (optimistic) placements applied.
  const view = $derived.by(() => {
    if (!project || sheetIdx < 0) return null;
    const sf = project.sheets[sheetIdx];
    let place = (sf.sheet.place ?? []).map((p) => (p.piece in pending ? (pending[p.piece] ? { ...p, ...pending[p.piece]! } : null) : p)).filter((p) => !!p);
    for (const [ref, at] of Object.entries(pending)) if (at && !place.some((p) => p.piece === ref)) place.push({ piece: ref, ...at });
    const sheets = project.sheets.map((s, i) => (i === sheetIdx ? { ...s, sheet: { ...s.sheet, place } } : s));
    const p = { ...project, sheets };
    const ix = buildIndex(p);
    return { p, ix, sheet: sheets[sheetIdx], layout: layoutSheet(p, sheets[sheetIdx], ix) };
  });

  const notDrawn = $derived.by(() => {
    if (!view) return [];
    const out: { ref: string; tag: string; name: string; symbol: string; desc: string; wired: boolean }[] = [];
    const kind = sheetKind(view.sheet.sheet.kind) ?? "ladder";
    for (const [ref, info] of view.ix.pieces) {
      if (view.ix.placed.has(ref) || !SYMBOLS[info.def.symbol]?.kinds.includes(kind)) continue;
      const wired = info.def.terminals.some((t) => view.ix.wireAt.has(`${info.device.tag}:${t}`));
      // Unused I/O points would swamp the list.
      if (!wired && (info.def.symbol.startsWith("plc/") || info.def.symbol === "nema/terminal")) continue;
      out.push({ ref, tag: info.device.tag, name: info.name, symbol: info.def.symbol, desc: info.device.desc ?? "", wired });
    }
    return out;
  });

  const counts = $derived({
    error: problems.filter((p) => p.severity === "error").length,
    warning: problems.filter((p) => p.severity === "warning").length,
    info: problems.filter((p) => p.severity === "info").length,
  });

  function pick(ref: string) {
    selected = { kind: "piece", ref };
    const pc = view?.layout.pieces.find((p) => p.ref === ref);
    if (!pc) return;
    drag = { ref, symbol: pc.info?.def.symbol ?? "", n: pc.info?.def.terminals.length ?? 2, text: pc.info?.def.text, line: pc.line, col: pc.col, over: false, fromList: false, start: { line: pc.line, col: pc.col } };
  }
  function pickFromList(e: PointerEvent, ref: string, symbol: string) {
    e.preventDefault();
    selected = { kind: "piece", ref };
    const def = view?.ix.pieces.get(ref)?.def;
    drag = { ref, symbol, n: def?.terminals.length ?? 2, text: def?.text, line: 0, col: 0, over: false, fromList: true };
  }
  function move(cell: { line: number; col: number } | null) {
    if (!drag) return;
    if (!cell) {
      drag.over = false;
      return;
    }
    drag.line = cell.line;
    drag.col = cell.col;
    drag.over = drag.fromList || cell.line !== drag.start?.line || cell.col !== drag.start?.col;
  }
  function drop() {
    const d = drag;
    drag = null;
    if (!d?.over) return;
    const taken = view?.sheet.sheet.place?.find((p) => p.piece !== d.ref && p.line === d.line && p.col === d.col);
    if (taken) {
      vscode.postMessage({ type: "warn", text: `line ${d.line}, column ${d.col} already has ${taken.piece}` });
      return;
    }
    pending = { ...pending, [d.ref]: { line: d.line, col: d.col } };
    vscode.postMessage({ type: "op", op: { type: d.fromList ? "place" : "move", piece: d.ref, line: d.line, col: d.col } });
  }
  function unplace(ref: string) {
    pending = { ...pending, [ref]: null };
    selected = null;
    vscode.postMessage({ type: "op", op: { type: "unplace", piece: ref } });
  }
  function reveal(file: string, find?: string) {
    vscode.postMessage({ type: "reveal", file, find });
  }
  function onkeydown(e: KeyboardEvent) {
    if ((e.target as HTMLElement).closest("input,textarea")) return;
    if ((e.key === "Delete" || e.key === "Backspace") && selected?.kind === "piece" && view?.layout.pieces.some((p) => p.ref === (selected as { ref: string }).ref)) {
      unplace(selected.ref);
      e.preventDefault();
    } else if (e.key === "Escape") {
      selected = null;
      drag = null;
    } else if (e.key === "f" || e.key === "F") sheetView?.fit();
    else if (e.key === "p" || e.key === "P") toggleBare();
  }

  // Properties of the selection.
  const selPiece = $derived(selected?.kind === "piece" && view ? view.ix.pieces.get(selected.ref) : undefined);
  const selWire = $derived(selected?.kind === "wire" && view ? view.ix.wires.get(selected.no) : undefined);
  function whereDrawn(term: string): string {
    if (!view) return "";
    const t = view.ix.terminals.get(term);
    const at = t ? view.ix.placed.get(t.piece.ref)?.[0] : undefined;
    if (!at) return "not drawn";
    return at.sheet === sheetName ? `line ${at.line}` : `${at.sheet}, line ${at.line}`;
  }
</script>

<svelte:window {onkeydown} onpointerup={() => { if (drag?.fromList) drag = null; }} />

{#if noProject}
  <div class="empty">No <code>sepia.json</code> at or above {noProject}. A sheet belongs to a sepia project folder.</div>
{:else if !project}
  <div class="empty">Loading…</div>
{:else if !view}
  <div class="empty">This sheet isn't in the project's <code>sheets/</code> folder.</div>
{:else}
  <div class="app" class:dragging={!!drag} class:bare>
    <header>
      <span class="title">{view.sheet.sheet.title ?? sheetName}</span>
      <span class="muted">{project.sepia.drawing} · sheet {sheetIdx + 1} of {project.sheets.length} · {view.layout.frame.kind === "power" ? "branches" : "lines"} {view.sheet.sheet.lines?.join("–")}</span>
      <span class="spacer"></span>
      <button onclick={toggleBare} title="Show or hide the side panels (P)">{bare ? "Show panels" : "Hide panels"}</button>
      <button onclick={() => sheetView?.fit()} title="Fit (F)">Fit</button>
      <button onclick={() => reveal(`sheets/${view.sheet.file}`)}>Sheet JSON</button>
      <button onclick={() => vscode.postMessage({ type: "print" })} title="The whole set as one PDF">Print PDF</button>
      <button onclick={() => reveal("panel.json")}>panel.json</button>
    </header>

    <aside class="left">
      <h3>Sheets</h3>
      {#each project.sheets as s, i}
        <button class="row" class:current={i === sheetIdx} onclick={() => vscode.postMessage({ type: "openSheet", file: s.file })}>
          <span class="num">{i + 1}</span>{s.sheet.title ?? s.name}
        </button>
      {/each}
      <h3>Not drawn <span class="muted">drag onto a {view.layout.frame.kind === "power" ? "branch" : "line"}</span></h3>
      {#each notDrawn.filter((n) => n.wired) as n (n.ref)}
        <div class="row draggable" role="button" tabindex="-1" onpointerdown={(e) => pickFromList(e, n.ref, n.symbol)} title={n.desc}>
          <b>{n.tag}</b>.{n.name} <span class="muted">{n.symbol.split("/")[1]}</span>
        </div>
      {:else}
        <p class="muted">Every piece on a wire is drawn.</p>
      {/each}
      <h3>Spare <span class="muted">no wires yet</span></h3>
      {#each notDrawn.filter((n) => !n.wired) as n (n.ref)}
        <div class="row draggable spare" role="button" tabindex="-1" onpointerdown={(e) => pickFromList(e, n.ref, n.symbol)} title={n.desc}>
          <b>{n.tag}</b>.{n.name} <span class="muted">{n.symbol.split("/")[1]}</span>
        </div>
      {/each}
    </aside>

    <main>
      <Sheet
        bind:this={sheetView}
        project={view.p}
        layout={view.layout}
        sheet={view.sheet}
        bind:selected
        {drag}
        onpick={pick}
        onmove={move}
        ondrop={drop}
      />
    </main>

    <aside class="right">
      {#if selPiece}
        <h3>{selPiece.device.tag} <span class="muted">.{selPiece.name}</span></h3>
        <p>{selPiece.device.desc}</p>
        <dl>
          <dt>Part</dt><dd>{selPiece.part?.manufacturer} {selPiece.part?.catalog}</dd>
          <dt>Symbol</dt><dd>{selPiece.def.symbol}</dd>
        </dl>
        <h4>Terminals</h4>
        <table>
          <tbody>
            {#each selPiece.def.terminals as t}
              {@const term = `${selPiece.device.tag}:${t}`}
              {@const w = view.ix.wireAt.get(term)}
              <tr>
                <td class="mono">{t}</td>
                <td>{#if w}<button class="link" onclick={() => (selected = { kind: "wire", no: w.no })}>wire {w.no}</button>{:else}<span class="muted">—</span>{/if}</td>
                <td class="muted">{w ? otherEnds(view.ix, term).join(", ") : ""}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        <div class="actions">
          <button onclick={() => reveal("panel.json", `"tag": "${selPiece!.device.tag}"`)}>Device in panel.json</button>
          <button onclick={() => reveal(`parts/${selPiece!.device.part}.json`)}>Part file</button>
          {#if view.layout.pieces.some((p) => p.ref === selPiece!.ref)}
            <button onclick={() => unplace(selPiece!.ref)}>Remove from sheet</button>
          {/if}
        </div>
        {#if selPiece.part?.notes}<p class="note">{selPiece.part.notes}</p>{/if}
      {:else if selWire}
        <h3>Wire {selWire.no}</h3>
        {#if selWire.class}
          {@const c = project.sepia.wireClasses?.[selWire.class]}
          <p>{c?.desc ?? selWire.class} · {c?.color} · {c?.awg} AWG</p>
        {/if}
        <h4>Run, in pull order</h4>
        <table>
          <tbody>
            {#each selWire.run as t, i}
              <tr><td class="num">{i + 1}</td><td class="mono">{t}</td><td class="muted">{whereDrawn(t)}</td></tr>
            {/each}
          </tbody>
        </table>
        <div class="actions"><button onclick={() => reveal("panel.json", `"no": "${selWire!.no}"`)}>Wire in panel.json</button></div>
      {:else}
        <h3>Nothing selected</h3>
        <p class="muted">Click a part or a wire. Drag a part to another line or column; the sheet file changes, panel.json never does.</p>
        <p class="muted">Connections come from panel.json: edit it (or have your agent edit it) and this redraws.</p>
      {/if}
    </aside>

    <footer>
      <span class="counts">
        <span class:bad={counts.error > 0}>{counts.error} errors</span> · {counts.warning} warnings · {counts.info} notes
      </span>
      <div class="problems">
        {#each problems as pr}
          <button class="problem {pr.severity}" onclick={() => reveal(pr.file, pr.find)}>
            <span class="sev">{pr.severity}</span> <span class="mono">{pr.file}</span> {pr.message}
          </button>
        {/each}
      </div>
    </footer>
  </div>
{/if}
