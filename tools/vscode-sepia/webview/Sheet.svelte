<script lang="ts">
  // One ladder sheet on paper. Everything drawn here is computed from the
  // project (core/ladder.ts); the only thing a gesture changes is where a
  // piece sits.
  import type { Project } from "../src/core/types.ts";
  import { cellAt, cellCentre, SHEET, type LadderLayout } from "../src/core/ladder.ts";
  import { SYMBOLS } from "../src/core/symbols.ts";
  import Symbol from "./Symbol.svelte";
  import TitleBlock from "./TitleBlock.svelte";

  type Sel = { kind: "piece"; ref: string } | { kind: "wire"; no: string } | null;

  let {
    project,
    layout,
    title,
    index,
    count,
    selected = $bindable(),
    drag,
    onpick,
    onmove,
    ondrop,
  }: {
    project: Project;
    layout: LadderLayout;
    title: string;
    index: number;
    count: number;
    selected: Sel;
    /** A piece being dragged (from the sheet or the unplaced list). */
    drag: { ref: string; symbol: string; line: number; col: number; over: boolean } | null;
    onpick: (ref: string) => void;
    onmove: (pt: { line: number; col: number } | null) => void;
    ondrop: () => void;
  } = $props();

  let svg: SVGSVGElement | undefined = $state();
  let host: HTMLDivElement | undefined = $state();
  // Paper view box; starts fitted.
  let vb = $state({ x: -20, y: -20, w: SHEET.w + 40, h: SHEET.h + 40 });

  export function fit(): void {
    if (!host) return;
    const r = host.getBoundingClientRect();
    const pad = 30;
    const scale = Math.max((SHEET.w + 2 * pad) / r.width, (SHEET.h + 2 * pad) / r.height);
    const w = r.width * scale, h = r.height * scale;
    vb = { x: SHEET.w / 2 - w / 2, y: SHEET.h / 2 - h / 2, w, h };
  }
  $effect(() => {
    if (!host) return;
    const ro = new ResizeObserver(() => fit());
    ro.observe(host);
    return () => ro.disconnect();
  });

  function toSheet(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const m = svg!.getScreenCTM()!.inverse();
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m);
    return { x: p.x, y: p.y };
  }

  function onwheel(e: WheelEvent) {
    e.preventDefault();
    const p = toSheet(e);
    const k = Math.exp(e.deltaY * 0.0015);
    const w = Math.min(SHEET.w * 4, Math.max(150, vb.w * k));
    const s = w / vb.w;
    vb = { x: p.x - (p.x - vb.x) * s, y: p.y - (p.y - vb.y) * s, w, h: vb.h * s };
  }

  // Background drag pans; a drag that starts on a piece moves it (App owns
  // that state via onmove/ondrop).
  let pan: { x: number; y: number; vb: typeof vb } | null = null;
  function onpointerdown(e: PointerEvent) {
    if ((e.target as Element).closest("[data-hit]")) return;
    pan = { x: e.clientX, y: e.clientY, vb: { ...vb } };
    svg!.setPointerCapture(e.pointerId);
  }
  function onpointermove(e: PointerEvent) {
    if (pan) {
      const s = vb.w / svg!.getBoundingClientRect().width;
      vb = { ...pan.vb, x: pan.vb.x - (e.clientX - pan.x) * s, y: pan.vb.y - (e.clientY - pan.y) * s };
      return;
    }
    if (drag) {
      const p = toSheet(e);
      const inside = p.x > SHEET.margin && p.x < SHEET.w - SHEET.margin && p.y > SHEET.margin && p.y < SHEET.h - SHEET.margin - SHEET.titleH;
      onmove(inside ? cellAt(layout.frame, p.x, p.y) : null);
    }
  }
  function onpointerup(e: PointerEvent) {
    if (pan) {
      const moved = Math.abs(e.clientX - pan.x) + Math.abs(e.clientY - pan.y) > 3;
      pan = null;
      if (!moved) selected = null;
      return;
    }
    if (drag) ondrop();
  }

  const f = $derived(layout.frame);
  const selWire = $derived(
    selected?.kind === "wire"
      ? new Set([selected.no])
      : selected?.kind === "piece"
        ? new Set(layout.pieces.find((p) => p.ref === selected.ref)?.ports.map((p) => p.wire).filter(Boolean) as string[])
        : new Set<string>()
  );
  const railY1 = $derived(f.top - 24);
  const railY2 = $derived(f.top + (f.lines.length - 1) * f.rowH + 12);
  const classDesc = (no: string) => {
    const w = project.panel.wires?.find((w) => w.no === no);
    return (w?.class && project.sepia.wireClasses?.[w.class]?.desc) || "";
  };
  const xrefText = (x: { line: number; nc: boolean }[]) => x;
</script>

<div class="canvas" bind:this={host}>
  <svg
    bind:this={svg}
    viewBox="{vb.x} {vb.y} {vb.w} {vb.h}"
    {onwheel}
    {onpointerdown}
    {onpointermove}
    {onpointerup}
    role="application"
    aria-label="sheet"
  >
    <rect class="paper" x="0" y="0" width={SHEET.w} height={SHEET.h} />
    <g class="ink">
      <TitleBlock {project} {title} {index} {count} />

      <!-- rails -->
      {#each [0, 1] as side}
        {@const rx = side ? f.railR : f.railL}
        <line class="rail" x1={rx} y1={railY1} x2={rx} y2={railY2} />
        <text x={rx} y={railY1 - 18} class="t-wire" text-anchor="middle">{layout.rails[side]}</text>
        <text x={rx} y={railY1 - 6} class="t-small" text-anchor="middle">{classDesc(layout.rails[side])}</text>
      {/each}

      <!-- line numbers -->
      {#each f.lines as n, i}
        <text x={f.railL - 14} y={f.top + i * f.rowH + 4} class="t-line" text-anchor="end">{n}</text>
      {/each}

      <!-- drop target -->
      {#if drag?.over}
        {@const c = cellCentre(f, drag.line, drag.col)}
        <rect class="drop" x={c.x - f.colW / 2} y={c.y - f.rowH / 2} width={f.colW} height={f.rowH} />
      {/if}

      <!-- wires -->
      {#each layout.segs as s}
        <line class="wire" class:sel={selWire.has(s.wire)} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} />
        <line class="hit" x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} data-hit
          role="button" tabindex="-1" aria-label="wire {s.wire}"
          onpointerdown={(e) => { e.stopPropagation(); selected = { kind: "wire", no: s.wire }; }} />
      {/each}
      {#each layout.dots as d}<circle class="dot" class:sel={selWire.has(d.wire)} cx={d.x} cy={d.y} r="3.5" />{/each}
      {#each layout.labels as l}
        <text x={l.x} y={l.y} class="t-wire" class:sel={selWire.has(l.wire)} text-anchor="middle">{l.text}</text>
      {/each}
      {#each layout.stubs as st}
        <g class:sel={selWire.has(st.wire)}>
          <line class="wire" x1={st.x} y1={st.y} x2={st.x + st.dir * 30} y2={st.y} />
          <path class="arrow" d="M{st.x + st.dir * 30},{st.y} l{-st.dir * 7},-4 v8 z" />
          <text x={st.x + st.dir * 36} y={st.y + 4} class="t-small" text-anchor={st.dir > 0 ? "start" : "end"}>{st.to.join(", ")}</text>
        </g>
      {/each}

      <!-- pieces -->
      {#each layout.pieces as pc (pc.ref)}
        {@const ghost = drag?.ref === pc.ref && drag.over}
        <g
          class="piece"
          class:sel={selected?.kind === "piece" && selected.ref === pc.ref}
          class:dragging={ghost}
          transform="translate({pc.cx},{pc.cy})"
          data-hit
          role="button"
          onpointerdown={(e) => { if (e.button !== 0) return; svg!.setPointerCapture(e.pointerId); onpick(pc.ref); }}
          tabindex="-1"
          aria-label={pc.ref}
        >
          <rect class="hit" x={-f.colW / 2 + 4} y={-f.rowH / 2} width={f.colW - 8} height={f.rowH} />
          <Symbol symbol={pc.info?.def.symbol ?? ""} />
          <text y={pc.info?.def.symbol === "nema/coil" ? -16 : -14} class="t-tag" text-anchor="middle">{pc.info?.device.tag ?? pc.ref}</text>
          {#if pc.info?.def.symbol?.startsWith("plc/")}
            <text y="4" class="t-small" text-anchor="middle">{pc.info.def.terminals[0]}</text>
          {:else}
            {#each pc.ports as pt, i}
              <text x={pt.x - pc.cx + (i ? -3 : 3)} y="12" class="t-term" text-anchor={i ? "end" : "start"}>{pc.info?.def.terminals[i]}</text>
            {/each}
          {/if}
          {#if pc.position}<text y="22" class="t-small" text-anchor="middle">{pc.position}</text>{/if}
        </g>
        {#if pc.xref?.length}
          <text x={f.railR + 12} y={pc.cy + 4} class="t-xref">
            {#each xrefText(pc.xref) as r, i}<tspan text-decoration={r.nc ? "overline" : undefined}>{r.line}</tspan>{i < pc.xref.length - 1 ? " " : ""}{/each}
          </text>
        {/if}
      {/each}

      <!-- right-margin descriptions, from the output device on each line -->
      {#each layout.notes as n}
        <text x={f.railR + 90} y={f.top + (n.line - f.lines[0]) * f.rowH + 4} class="t-note">{n.text.toUpperCase()}</text>
      {/each}

      <!-- the piece in flight -->
      {#if drag?.over}
        {@const c = cellCentre(f, drag.line, drag.col)}
        <g class="piece ghost" transform="translate({c.x},{c.y})"><Symbol symbol={drag.symbol} /></g>
      {/if}
    </g>
  </svg>
</div>
