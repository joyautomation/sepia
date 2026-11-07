<script lang="ts">
  // Drafting chrome, filled from sepia.json, git and the sheet list. Nothing
  // here is positioned by a person (docs/design.md §3.4).
  import type { Project } from "../src/core/types.ts";
  import { SHEET } from "../src/core/ladder.ts";

  let { project, title, index, count }: { project: Project; title: string; index: number; count: number } = $props();

  const W = SHEET.w, H = SHEET.h, M = SHEET.margin, TH = SHEET.titleH;
  const y0 = H - M - TH;
  // Column edges of the title strip, left to right.
  const x = [M, M + 430, M + 960, M + 1210, M + 1450, W - M];
  const zonesX = 8, zonesY = 4;
  const rev = $derived(project.revision);
  const s = $derived(project.sepia);
  const revRows = $derived([...rev.history.slice(-3), ...(rev.issued ? [] : [{ rev: rev.rev, date: rev.date, desc: "draft" }])]);
</script>

<g class="frame">
  <rect x={M / 2} y={M / 2} width={W - M} height={H - M} class="border-outer" />
  <rect x={M} y={M} width={W - 2 * M} height={H - 2 * M} class="border" />
  {#each Array(zonesX) as _, i}
    {@const cx = M + ((i + 0.5) * (W - 2 * M)) / zonesX}
    <text x={cx} y={M - 8} class="t-zone" text-anchor="middle">{zonesX - i}</text>
    <text x={cx} y={H - M + 18} class="t-zone" text-anchor="middle">{zonesX - i}</text>
    {#if i > 0}<line x1={M + (i * (W - 2 * M)) / zonesX} y1={M / 2} x2={M + (i * (W - 2 * M)) / zonesX} y2={M} /><line x1={M + (i * (W - 2 * M)) / zonesX} y1={H - M} x2={M + (i * (W - 2 * M)) / zonesX} y2={H - M / 2} />{/if}
  {/each}
  {#each Array(zonesY) as _, i}
    {@const cy = M + ((i + 0.5) * (H - 2 * M)) / zonesY}
    <text x={M / 2 + 12} y={cy + 4} class="t-zone" text-anchor="middle">{"DCBA"[i]}</text>
    <text x={W - M / 2 - 12} y={cy + 4} class="t-zone" text-anchor="middle">{"DCBA"[i]}</text>
    {#if i > 0}<line x1={M / 2} y1={M + (i * (H - 2 * M)) / zonesY} x2={M} y2={M + (i * (H - 2 * M)) / zonesY} /><line x1={W - M} y1={M + (i * (H - 2 * M)) / zonesY} x2={W - M / 2} y2={M + (i * (H - 2 * M)) / zonesY} />{/if}
  {/each}

  <!-- title strip -->
  <rect x={M} y={y0} width={W - 2 * M} height={TH} class="border" />
  {#each x.slice(1, -1) as cx}<line x1={cx} y1={y0} x2={cx} y2={H - M} />{/each}

  <!-- revisions -->
  <text x={x[0] + 8} y={y0 + 16} class="t-head">REV</text>
  <text x={x[0] + 50} y={y0 + 16} class="t-head">DATE</text>
  <text x={x[0] + 150} y={y0 + 16} class="t-head">DESCRIPTION</text>
  <line x1={x[0]} y1={y0 + 22} x2={x[1]} y2={y0 + 22} />
  {#each revRows as r, i}
    <text x={x[0] + 8} y={y0 + 42 + i * 22} class="t-body">{r.rev}</text>
    <text x={x[0] + 50} y={y0 + 42 + i * 22} class="t-body">{r.date}</text>
    <text x={x[0] + 150} y={y0 + 42 + i * 22} class="t-body">{r.desc}</text>
  {/each}

  <!-- owner, project, sheet title -->
  <text x={x[1] + 12} y={y0 + 28} class="t-company">{s.company ?? ""}</text>
  <text x={x[1] + 12} y={y0 + 56} class="t-body">{s.project ?? ""}</text>
  <text x={x[1] + 12} y={y0 + 76} class="t-small">{s.client ?? ""}</text>
  <line x1={x[1]} y1={y0 + 90} x2={x[2]} y2={y0 + 90} />
  <text x={x[1] + 12} y={y0 + 104} class="t-head">SHEET TITLE</text>
  <text x={x[1] + 12} y={y0 + 134} class="t-title">{title.toUpperCase()}</text>

  <!-- people -->
  {#each [["DRAWN", s.people?.drawn], ["CHECKED", s.people?.checked], ["APPROVED", s.people?.approved]] as [k, v], i}
    <text x={x[2] + 10} y={y0 + 18 + i * 44} class="t-head">{k}</text>
    <text x={x[2] + 10} y={y0 + 38 + i * 44} class="t-body">{v || "—"}</text>
    {#if i}<line x1={x[2]} y1={y0 + i * 44 + 2} x2={x[3]} y2={y0 + i * 44 + 2} />{/if}
  {/each}

  <!-- drawing number, sheet, rev -->
  <text x={x[3] + 10} y={y0 + 18} class="t-head">DWG NO</text>
  <text x={x[3] + 10} y={y0 + 46} class="t-dwg">{s.drawing ?? ""}</text>
  <line x1={x[3]} y1={y0 + 60} x2={x[4]} y2={y0 + 60} />
  <text x={x[3] + 10} y={y0 + 76} class="t-head">SHEET</text>
  <text x={x[3] + 10} y={y0 + 100} class="t-body">{index} OF {count}</text>
  <line x1={x[3] + 120} y1={y0 + 60} x2={x[3] + 120} y2={H - M} />
  <text x={x[3] + 130} y={y0 + 76} class="t-head">REV</text>
  <text x={x[3] + 130} y={y0 + 100} class="t-body">{rev.rev}{rev.issued ? "" : " DRAFT"}</text>
  <line x1={x[3]} y1={y0 + 112} x2={x[4]} y2={y0 + 112} />
  <text x={x[3] + 10} y={y0 + 132} class="t-small">{rev.issued ? `ISSUED ${rev.date}` : `PRINTED ${rev.date}`}</text>

  <!-- PE stamp area -->
  <text x={(x[4] + x[5]) / 2} y={y0 + 18} class="t-head" text-anchor="middle">ENGINEER'S SEAL</text>
  {#if s.seal?.engineer}
    <text x={(x[4] + x[5]) / 2} y={y0 + TH - 30} class="t-small" text-anchor="middle">{s.seal.engineer}</text>
    <text x={(x[4] + x[5]) / 2} y={y0 + TH - 14} class="t-small" text-anchor="middle">{s.seal.state} {s.seal.license}</text>
  {/if}

  {#if !rev.issued}
    <g class="stamp">
      <rect x={x[1]} y={y0 - 30} width={x[4] - x[1]} height={22} />
      <text x={(x[1] + x[4]) / 2} y={y0 - 15} text-anchor="middle">PRELIMINARY · NOT FOR CONSTRUCTION · {rev.rev} draft{rev.commit ? `, ${rev.commit}` : ""}</text>
    </g>
  {/if}
</g>
