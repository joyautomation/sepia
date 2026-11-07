<script lang="ts">
  import { onMount } from "svelte";
  import type { Mount, Problem, Project } from "../src/core/types.ts";
  import { buildIndex, otherEnds } from "../src/core/model.ts";
  import { conductors } from "../src/core/conductors.ts";
  import { drawSymbol, renderSheet, setIndex } from "../src/core/sheetDraw.ts";
  import { cellAt, cellCentre } from "../src/core/ladder.ts";
  import { bodyOf, snapMount, type Body } from "../src/core/backpanel.ts";
  import { Pen } from "../src/core/draw.ts";
  import { sheetKind, SYMBOLS } from "../src/core/symbols.ts";
  import { vscode } from "./vscodeApi.ts";
  import type { Preview, Sel } from "./preview.ts";
  import Sheet from "./Sheet.svelte";

  /** A piece onto a ladder or power sheet's grid. */
  type PieceDrag = { mode: "piece"; ref: string; symbol: string; n: number; text?: string; fromList: boolean; start?: { line: number; col: number }; cell: { line: number; col: number } | null };
  /** A device onto a layout sheet's rails, backpanel or door. */
  type MountDrag = { mode: "mount"; tag: string; body: Body; fromList: boolean; start?: Mount; target: ReturnType<typeof snapMount> };
  type Drag = PieceDrag | MountDrag;

  let project = $state<Project | null>(null);
  let sheetName = $state("");
  let problems = $state<Problem[]>([]);
  let noProject = $state("");
  let selected = $state<Sel>(null);
  let drag = $state<Drag | null>(null);
  /** Optimistic placements and mounts until the host's next project message. */
  let pending: Record<string, { line: number; col: number } | null> = $state({});
  let pendingMount: Record<string, Mount | null> = $state({});
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
        pendingMount = {};
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
    let mount = (sf.sheet.mount ?? []).map((m) => (m.device in pendingMount ? pendingMount[m.device] : m)).filter((m) => !!m);
    for (const [tag, m] of Object.entries(pendingMount)) if (m && !mount.some((x) => x.device === tag)) mount.push(m);
    const sheet = { ...sf.sheet, place, ...(sf.sheet.kind === "layout" ? { mount } : {}) };
    const sheets = project.sheets.map((s, i) => (i === sheetIdx ? { ...s, sheet } : s));
    const p = { ...project, sheets };
    const ix = buildIndex(p);
    const r = renderSheet(p, sheets[sheetIdx], ix);
    return { p, ix, sheet: sheets[sheetIdx], layout: r.layout, panel: r.panel, pages: r.pages, set: setIndex(p, ix) };
  });
  /** Which page of a multi-page (generated) sheet is showing. */
  let page = $state(0);
  $effect(() => {
    void sheetName;
    page = 0;
  });
  const pageNo = $derived(view ? Math.min(page, view.pages.length - 1) : 0);
  const sheetLabel = $derived.by(() => {
    if (!view) return "";
    const sp = view.set.pages.filter((x) => x.sheet.name === view.sheet.name)[pageNo];
    return sp?.number === undefined ? "cover" : `sheet ${sp.number} of ${view.set.count}`;
  });

  type Listed = { ref: string; tag: string; name: string; symbol: string; desc: string; wired: boolean };
  const notDrawn = $derived.by(() => {
    const out: Listed[] = [];
    if (!view?.layout) return out;
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
  /** Layout: devices in the enclosure that no layout sheet mounts yet. */
  const notMounted = $derived.by(() => {
    if (!view?.panel) return [];
    const mounted = new Set(view.p.sheets.filter((s) => s.sheet.kind === "layout").flatMap((s) => (s.sheet.mount ?? []).map((m) => m.device)));
    return [...view.ix.devices.values()]
      .filter((d) => !d.field && !mounted.has(d.tag) && d.tag !== view.sheet.sheet.enclosure)
      .map((d) => ({ tag: d.tag, desc: d.desc ?? "", body: bodyOf(view.p, view.ix, d.tag)! }));
  });

  const counts = $derived({
    error: problems.filter((p) => p.severity === "error").length,
    warning: problems.filter((p) => p.severity === "warning").length,
    info: problems.filter((p) => p.severity === "info").length,
  });

  function pick(ref: string) {
    if (view?.panel) {
      const it = view.panel.items.find((i) => i.tag === ref);
      selected = { kind: "device", tag: ref };
      if (!it || !["din", "backpanel", "door"].includes(it.kind ?? "")) return;
      const start = view.sheet.sheet.mount?.find((m) => m.device === ref);
      drag = { mode: "mount", tag: ref, body: it, fromList: false, start, target: null };
      return;
    }
    selected = { kind: "piece", ref };
    const pc = view?.layout?.pieces.find((p) => p.ref === ref);
    if (!pc) return;
    drag = { mode: "piece", ref, symbol: pc.info?.def.symbol ?? "", n: pc.info?.def.terminals.length ?? 2, text: pc.info?.def.text, fromList: false, start: { line: pc.line, col: pc.col }, cell: null };
  }
  function pickFromList(e: PointerEvent, ref: string, symbol: string) {
    e.preventDefault();
    selected = { kind: "piece", ref };
    const def = view?.ix.pieces.get(ref)?.def;
    drag = { mode: "piece", ref, symbol, n: def?.terminals.length ?? 2, text: def?.text, fromList: true, cell: null };
  }
  function pickToMount(e: PointerEvent, tag: string, body: Body) {
    e.preventDefault();
    selected = { kind: "device", tag };
    drag = { mode: "mount", tag, body, fromList: true, target: null };
  }
  function move(pt: { x: number; y: number } | null) {
    if (!drag || !view) return;
    if (drag.mode === "piece") {
      const cell = pt && view.layout ? cellAt(view.layout.frame, pt.x, pt.y) : null;
      drag.cell = cell && (drag.fromList || cell.line !== drag.start?.line || cell.col !== drag.start?.col) ? cell : null;
    } else {
      const t = pt && view.panel ? snapMount(view.panel, drag.tag, drag.body, pt.x, pt.y) : null;
      const s = drag.start;
      drag.target = t && (drag.fromList || t.on !== s?.on || t.x !== s?.x || (t.y !== undefined && t.y !== s?.y)) ? t : null;
    }
  }
  // What the drag would do now, drawn by the sheet.
  const preview = $derived.by((): Preview | null => {
    if (!drag || !view) return null;
    if (drag.mode === "piece") {
      const f = view.layout?.frame;
      if (!drag.cell || !f) return null;
      const c = cellCentre(f, drag.cell.line, drag.cell.col);
      const pen = new Pen();
      drawSymbol(pen, drag.symbol, drag.n, { text: drag.text });
      return { rect: { x: c.x - f.colW / 2, y: c.y - f.rowH / 2, w: f.colW, h: f.rowH }, at: c, items: pen.items };
    }
    const t = drag.target;
    if (!t) return null;
    const pen = new Pen();
    pen.rect(0, 0, t.rect.w, t.rect.h, { fill: "#ffffff", s: { width: 1 } });
    pen.text(t.rect.w / 2, t.rect.h / 2 + 2, drag.tag, { size: 6.5, anchor: "middle" });
    return { rect: t.rect, at: { x: t.rect.x, y: t.rect.y }, items: pen.items };
  });
  function drop() {
    const d = drag;
    drag = null;
    if (!d) return;
    if (d.mode === "mount") {
      const t = d.target;
      if (!t) return;
      const m: Mount = { device: d.tag, ...(t.on !== undefined ? { on: t.on } : {}), x: t.x, ...(t.y !== undefined ? { y: t.y } : {}) };
      pendingMount = { ...pendingMount, [d.tag]: m };
      vscode.postMessage({ type: "op", op: { type: "mount", ...m } });
      return;
    }
    const c = d.cell;
    if (!c) return;
    const taken = view?.sheet.sheet.place?.find((p) => p.piece !== d.ref && p.line === c.line && p.col === c.col);
    if (taken) {
      vscode.postMessage({ type: "warn", text: `line ${c.line}, column ${c.col} already has ${taken.piece}` });
      return;
    }
    pending = { ...pending, [d.ref]: { line: c.line, col: c.col } };
    vscode.postMessage({ type: "op", op: { type: d.fromList ? "place" : "move", piece: d.ref, line: c.line, col: c.col } });
  }
  function unplace(ref: string) {
    pending = { ...pending, [ref]: null };
    selected = null;
    vscode.postMessage({ type: "op", op: { type: "unplace", piece: ref } });
  }
  function unmount(tag: string) {
    pendingMount = { ...pendingMount, [tag]: null };
    selected = null;
    vscode.postMessage({ type: "op", op: { type: "unmount", device: tag } });
  }
  function reveal(file: string, find?: string) {
    vscode.postMessage({ type: "reveal", file, find });
  }
  function onkeydown(e: KeyboardEvent) {
    if ((e.target as HTMLElement).closest("input,textarea")) return;
    if (e.key === "Delete" || e.key === "Backspace") {
      if (selected?.kind === "piece" && view?.layout?.pieces.some((p) => p.ref === (selected as { ref: string }).ref)) {
        unplace(selected.ref);
        e.preventDefault();
      } else if (selected?.kind === "device" && view?.panel?.items.some((i) => i.tag === (selected as { tag: string }).tag)) {
        unmount(selected.tag);
        e.preventDefault();
      }
    } else if (e.key === "Escape") {
      selected = null;
      drag = null;
    } else if (e.key === "f" || e.key === "F") sheetView?.fit();
    else if (e.key === "p" || e.key === "P") toggleBare();
  }

  // Properties of the selection.
  const selPiece = $derived(selected?.kind === "piece" && view ? view.ix.pieces.get(selected.ref) : undefined);
  const selWire = $derived(selected?.kind === "wire" && view ? view.ix.wires.get(selected.no) : undefined);
  const selDevice = $derived.by(() => {
    if (selected?.kind !== "device" || !view) return undefined;
    const tag = selected.tag;
    const dev = view.ix.devices.get(tag);
    if (!dev) return undefined;
    const item = view.panel?.items.find((i) => i.tag === tag);
    const body = bodyOf(view.p, view.ix, tag);
    const drawn = [...view.ix.pieces.values()]
      .filter((pc) => pc.device.tag === tag && view.ix.placed.has(pc.ref))
      .map((pc) => { const at = view.ix.placed.get(pc.ref)![0]; return `${pc.name}: ${at.sheet}, line ${at.line}`; });
    return { dev, item, body, drawn };
  });
  function whereMounted(it: { on?: string; x: number; y: number; face: string }): string {
    const r = view?.panel?.rails.find((x) => x.id === it.on);
    if (r) return `rail ${r.id}, ${Math.round(it.x)} mm from the backpanel's left edge`;
    if (it.on === "door") return `door, ${Math.round(it.x)} × ${Math.round(it.y)} mm from its top-left`;
    if (it.on && ["top", "left", "right"].includes(it.on)) return `outside, on the ${it.on}`;
    if (it.on) return `on ${it.on}`;
    return `backpanel, ${Math.round(it.x)} × ${Math.round(it.y)} mm from its top-left`;
  }
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
      <span class="muted">{project.sepia.drawing} · {sheetLabel}{#if view.layout} · {view.layout.frame.kind === "power" ? "branches" : "lines"} {view.sheet.sheet.lines?.join("–")}{:else if view.panel} · scale 1:{view.panel.scale}{:else} · generated from the data{/if}</span>
      {#if view.pages.length > 1}
        <span class="pager">
          <button disabled={pageNo === 0} onclick={() => (page = pageNo - 1)} title="Previous page">‹</button>
          page {pageNo + 1} of {view.pages.length}
          <button disabled={pageNo >= view.pages.length - 1} onclick={() => (page = pageNo + 1)} title="Next page">›</button>
        </span>
      {/if}
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
          <span class="num">{view.set.pages.find((sp) => sp.sheet.name === s.name)?.number ?? "–"}</span>{s.sheet.title ?? s.name}
        </button>
      {/each}
      {#if view.layout}
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
      {/if}
      {#if view.panel}
      <h3>Not mounted <span class="muted">drag onto a rail, the backpanel or the door</span></h3>
      {#each notMounted as n (n.tag)}
        <div class="row draggable" role="button" tabindex="-1" onpointerdown={(e) => pickToMount(e, n.tag, n.body)} title={n.desc}>
          <b>{n.tag}</b> <span class="muted">{n.body.kind ?? "no mount"}{n.body.sized ? "" : ", no size"}</span>
        </div>
      {:else}
        <p class="muted">Every device in the enclosure is mounted.</p>
      {/each}
      {/if}
    </aside>

    <main>
      <Sheet
        bind:this={sheetView}
        layout={view.layout}
        panel={view.panel}
        prims={view.pages[pageNo] ?? []}
        bind:selected
        dragging={!!drag}
        lifted={drag ? (drag.mode === "piece" ? drag.ref : drag.tag) : undefined}
        {preview}
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
          {#if view.layout?.pieces.some((p) => p.ref === selPiece!.ref)}
            <button onclick={() => unplace(selPiece!.ref)}>Remove from sheet</button>
          {/if}
        </div>
        {#if selPiece.part?.notes}<p class="note">{selPiece.part.notes}</p>{/if}
      {:else if selDevice}
        {@const d = selDevice}
        <h3>{d.dev.tag}</h3>
        <p>{d.dev.desc}</p>
        <dl>
          <dt>Part</dt><dd>{d.body?.part?.manufacturer} {d.body?.part?.catalog ?? d.dev.part}</dd>
          <dt>Mounts</dt><dd>{d.body?.kind ?? "not said"}{#if d.body?.part?.mount?.door} ({d.body.part.mount.door} cutout){/if}</dd>
          <dt>Size</dt><dd>{#if d.body?.sized}{d.body.w} × {d.body.h} × {d.body.d} mm{:else}<span class="muted">none in the part file</span>{/if}</dd>
          <dt>Where</dt><dd>{d.item ? whereMounted(d.item) : "not mounted"}</dd>
        </dl>
        {#if d.drawn.length}
          <h4>Drawn</h4>
          <ul class="plain">{#each d.drawn as w}<li>{w}</li>{/each}</ul>
        {/if}
        <div class="actions">
          <button onclick={() => reveal("panel.json", `"tag": "${d.dev.tag}"`)}>Device in panel.json</button>
          <button onclick={() => reveal(`parts/${d.dev.part}.json`)}>Part file</button>
          {#if d.item}<button onclick={() => unmount(d.dev.tag)}>Take off the layout</button>{/if}
        </div>
        {#if d.body?.part?.notes}<p class="note">{d.body.part.notes}</p>{/if}
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
        <h4>Conductors and sleeves</h4>
        <table>
          <tbody>
            {#each conductors(view.p, view.ix).filter((c) => c.wire.no === selWire!.no) as c}
              <tr><td class="mono">{c.from}</td><td class="muted">{c.markFrom}</td><td class="mono">{c.to}</td><td class="muted">{c.markTo}</td></tr>
            {/each}
          </tbody>
        </table>
        <div class="actions"><button onclick={() => reveal("panel.json", `"no": "${selWire!.no}"`)}>Wire in panel.json</button></div>
      {:else}
        <h3>Nothing selected</h3>
        {#if view.panel}
        <p class="muted">Click a device. Drag one along its rail or onto another; parts screwed to the backpanel or the door move in 5 mm steps. The sheet file changes, panel.json never does.</p>
        {:else}
        <p class="muted">Click a part or a wire. Drag a part to another line or column; the sheet file changes, panel.json never does.</p>
        {/if}
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
