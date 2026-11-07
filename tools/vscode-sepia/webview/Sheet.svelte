<script lang="ts">
  // One ladder sheet on paper. Everything drawn here is computed from the
  // project (core/ladder.ts); the only thing a gesture changes is where a
  // piece sits.
  import { SHEET, type LadderLayout } from "../src/core/ladder.ts";
  import { INK, svgPath, textStart, type Meta, type Prim } from "../src/core/draw.ts";
  import { toSheet as itemRect, type PanelLayout } from "../src/core/backpanel.ts";

  import type { Preview, Sel } from "./preview.ts";

  let {
    layout,
    panel,
    prims,
    selected = $bindable(),
    dragging,
    lifted,
    preview,
    onpick,
    onmove,
    ondrop,
  }: {
    /** A ladder or power sheet's layout: pieces and wires to pick. */
    layout?: LadderLayout;
    /** A panel layout sheet's: devices to pick. Neither on a generated page. */
    panel?: PanelLayout;
    /** The ink: exactly what `sepia print` writes for this page. */
    prims: Prim[];
    selected: Sel;
    /** A drag is under way (from the sheet or a list in the side panel). */
    dragging: boolean;
    /** The piece or device being dragged, drawn faded where it was. */
    lifted?: string;
    preview: Preview | null;
    /** A piece ref (ladder, power) or a device tag (layout). */
    onpick: (ref: string) => void;
    /** Where the pointer is on the paper, in sheet units; null off it. */
    onmove: (pt: { x: number; y: number } | null) => void;
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
    if (dragging) {
      const p = toSheet(e);
      const inside = p.x > SHEET.margin && p.x < SHEET.w - SHEET.margin && p.y > SHEET.margin && p.y < SHEET.h - SHEET.margin - SHEET.titleH;
      onmove(inside ? p : null);
    }
  }
  function onpointerup(e: PointerEvent) {
    if (pan) {
      const moved = Math.abs(e.clientX - pan.x) + Math.abs(e.clientY - pan.y) > 3;
      pan = null;
      if (!moved) selected = null;
      return;
    }
    if (dragging) ondrop();
  }

  const f = $derived(layout?.frame);
  const selWire = $derived.by(() => {
    const s = selected;
    if (s?.kind === "wire") return new Set([s.no]);
    if (s?.kind === "piece" && layout) return new Set(layout.pieces.find((p) => p.ref === s.ref)?.ports.map((p) => p.wire).filter(Boolean) as string[]);
    return new Set<string>();
  });
  const isSel = (m: Meta | undefined) =>
    !!m &&
    ((m.wire !== undefined && selWire.has(m.wire)) ||
      (selected?.kind === "piece" && m.piece === selected.ref) ||
      (selected?.kind === "device" && m.device === selected.tag));
</script>

{#snippet ink(items: Prim[])}
  {#each items as p}
    {@const cls = { sel: isSel(p.meta), lifted: !!preview && !!lifted && (p.meta?.piece === lifted || p.meta?.device === lifted) }}
    {#if p.t === "line"}
      <line class={cls} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={p.s.color ?? INK} stroke-width={p.s.width ?? 1} stroke-dasharray={p.s.dash?.join(" ")} />
    {:else if p.t === "rect"}
      <rect class={cls} x={p.x} y={p.y} width={p.w} height={p.h} fill={p.fill ?? "none"} stroke={p.s ? (p.s.color ?? INK) : "none"} stroke-width={p.s?.width ?? 1} stroke-dasharray={p.s?.dash?.join(" ")} />
    {:else if p.t === "circle"}
      <circle class={cls} cx={p.cx} cy={p.cy} r={p.r} fill={p.fill ?? "none"} stroke={p.s ? (p.s.color ?? INK) : "none"} stroke-width={p.s?.width ?? 1} />
    {:else if p.t === "path"}
      <path class={cls} d={svgPath(p.d)} fill={p.fill ?? "none"} stroke={p.s ? (p.s.color ?? INK) : "none"} stroke-width={p.s?.width ?? 1} />
    {:else}
      {@const at = textStart(p)}
      <text class={cls} x={at.x} y={at.y} transform={p.vertical ? `rotate(-90 ${at.x} ${at.y})` : undefined} font-size={p.size} font-weight={p.bold ? "bold" : "normal"} fill={p.color ?? INK}>{p.text}</text>
    {/if}
  {/each}
{/snippet}

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

    <!-- drop target -->
    {#if preview}
      <rect class="drop" x={preview.rect.x} y={preview.rect.y} width={preview.rect.w} height={preview.rect.h} />
    {/if}

    <g class="ink" stroke-linecap="round" stroke-linejoin="round">{@render ink(prims)}</g>

    <!-- interaction: invisible hit areas from the layout, not the ink -->
    {#if layout && f}
    {#each layout.segs as s}
      <line class="hit" x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} data-hit
        role="button" tabindex="-1" aria-label="wire {s.wire}"
        onpointerdown={(e) => { e.stopPropagation(); selected = { kind: "wire", no: s.wire }; }} />
    {/each}
    {#each layout.pieces as pc (pc.ref)}
      <rect
        class="hit piece"
        x={pc.cx - f.colW / 2 + 4}
        y={pc.cy - f.rowH / 2}
        width={f.colW - 8}
        height={f.rowH}
        data-hit
        role="button"
        tabindex="-1"
        aria-label={pc.ref}
        onpointerdown={(e) => { if (e.button !== 0) return; svg!.setPointerCapture(e.pointerId); onpick(pc.ref); }}
      />
    {/each}
    {/if}
    {#if panel}
    {#each panel.items as it (it.tag)}
      {@const r = itemRect(panel, it.face, it)}
      <rect
        class="hit piece"
        x={r.x}
        y={r.y}
        width={Math.max(r.w, 4)}
        height={Math.max(r.h, 4)}
        data-hit
        role="button"
        tabindex="-1"
        aria-label={it.tag}
        onpointerdown={(e) => { if (e.button !== 0) return; svg!.setPointerCapture(e.pointerId); onpick(it.tag); }}
      />
    {/each}
    {/if}

    <!-- the piece in flight -->
    {#if preview}
      <g class="ink ghost" transform="translate({preview.at.x},{preview.at.y})" stroke-linecap="round">{@render ink(preview.items)}</g>
    {/if}
  </svg>
</div>
