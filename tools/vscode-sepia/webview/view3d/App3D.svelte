<script lang="ts">
  // The panel in 3D: one layout sheet's enclosure, backpanel, rails, duct
  // and parts as boxes. Hover names a part; a click shows it on the right.
  // It edits nothing: the layout sheet is where things move.
  import { onDestroy, onMount } from "svelte";
  import { buildIndex } from "../../src/core/model.ts";
  import { panelLayout, type Item } from "../../src/core/backpanel.ts";
  import { panelScene, type Box3, type Scene3D } from "../../src/core/scene3d.ts";
  import type { Problem, Project } from "../../src/core/types.ts";
  import { vscode } from "../vscodeApi.ts";
  import { Stage, type ViewName } from "./stage.ts";

  let project = $state<Project | undefined>();
  let problems = $state<Problem[]>([]);
  let sheetName = $state("");
  let canvas = $state<HTMLCanvasElement>();
  let stage: Stage | undefined;
  let tip = $state<{ box: Box3; x: number; y: number } | undefined>();
  let picked = $state<string | undefined>();
  let doorOpen = $state(false);
  let toggles = $state({ walls: true, clearances: true, tags: true });

  const view = $derived.by(() => {
    if (!project) return undefined;
    const s = project.sheets.find((x) => x.name === sheetName);
    if (!s || s.sheet.kind !== "layout") return undefined;
    const ix = buildIndex(project);
    const L = panelLayout(project, s, ix);
    const S = panelScene(project, s, ix, L);
    const mine = problems.filter((p) => p.file === `sheets/${s.file}` && p.severity !== "info");
    const bad = new Map<string, "error" | "warning">();
    for (const p of mine) {
      const tag = /"device": "([^"]+)"/.exec(p.find ?? "")?.[1];
      if (tag && bad.get(tag) !== "error") bad.set(tag, p.severity === "error" ? "error" : "warning");
    }
    return { s, L, S, mine, bad };
  });

  $effect(() => {
    if (view && stage) stage.setScene(view.S, view.bad);
  });
  $effect(() => stage?.highlight(picked));

  const item = (tag: string | undefined): Item | undefined => (tag ? view?.L.items.find((i) => i.tag === tag) : undefined);
  const boxOf = (tag: string | undefined): Box3 | undefined => (tag ? view?.S.boxes.find((b) => b.id === `part:${tag}`) : undefined);

  function depthLine(S: Scene3D, b: Box3): string {
    const E = S.enclosure;
    const room = E.d - E.door - E.panelFace;
    if (b.on === "inside") return `stands ${Math.round(b.d)} mm off the backpanel; ${Math.round(room - b.d)} mm to the door`;
    if (b.on === "door") return `reaches ${Math.round(b.d)} mm behind the door`;
    return `outside the enclosure, ${Math.round(b.w)} × ${Math.round(b.h)} × ${Math.round(b.d)} mm`;
  }

  function onMsg(e: MessageEvent) {
    const m = e.data;
    if (m?.type === "project") {
      project = m.project;
      problems = m.problems ?? [];
      sheetName = m.sheet;
    }
  }

  function setDoor(open: boolean) {
    doorOpen = open;
    stage?.setDoor(open);
  }
  function toggle(k: keyof typeof toggles) {
    toggles[k] = !toggles[k];
    if (stage) {
      stage.toggles = { ...toggles };
      stage.apply();
    }
  }
  function look(v: ViewName) {
    stage?.view(v);
  }
  function key(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement) return;
    if (e.key === "f" || e.key === "F") look("iso");
    else if (e.key === "d" || e.key === "D") setDoor(!doorOpen);
    else if (e.key === "Escape") picked = undefined;
  }

  onMount(() => {
    window.addEventListener("message", onMsg);
    window.addEventListener("keydown", key);
    vscode.postMessage({ type: "ready" });
  });
  onDestroy(() => {
    window.removeEventListener("message", onMsg);
    window.removeEventListener("keydown", key);
    stage?.dispose();
  });

  let noGl = $state("");
  $effect(() => {
    if (!canvas || stage || noGl) return;
    try {
      stage = new Stage(
        canvas,
        (box, x, y) => (tip = box ? { box, x, y } : undefined),
        (box) => (picked = box?.tag),
      );
    } catch (e) {
      noGl = String((e as Error)?.message ?? e);
      return;
    }
    if (view) stage.setScene(view.S, view.bad);
  });

  // For the gesture harness: read-only views of what's on screen.
  (window as unknown as { __view3d: unknown }).__view3d = {
    screenOf: (id: string) => stage?.screenOf(id) ?? null,
    tip: () => (tip ? tip.box.label ?? tip.box.id : null),
    picked: () => picked ?? null,
    door: () => (stage?.doorOpen ? "open" : "closed"),
    view: (v: ViewName) => stage?.view(v),
  };
</script>

<svelte:head><title>sepia 3D</title></svelte:head>

{#if !project}
  <div class="empty">Loading…</div>
{:else if !view}
  <div class="empty">{sheetName} isn't a layout sheet in this project.</div>
{:else}
  <div class="app3d">
    <header>
      <span class="title">{view.s.sheet.title ?? sheetName}</span>
      <span class="muted">{project.sepia.drawing} · 3D · {view.S.enclosure.w} × {view.S.enclosure.h} × {view.S.enclosure.d} mm</span>
      <span class="spacer"></span>
      <button onclick={() => setDoor(!doorOpen)} title="Open or close the door (D)">{doorOpen ? "Close door" : "Open door"}</button>
      <button class:off={!toggles.walls} onclick={() => toggle("walls")}>Walls</button>
      <button class:off={!toggles.clearances} onclick={() => toggle("clearances")}>Clearances</button>
      <button class:off={!toggles.tags} onclick={() => toggle("tags")}>Tags</button>
      <span class="views">
        <button onclick={() => look("iso")} title="Fit (F)">Iso</button>
        <button onclick={() => look("front")}>Front</button>
        <button onclick={() => look("right")}>Side</button>
        <button onclick={() => look("top")}>Top</button>
      </span>
      <button onclick={() => vscode.postMessage({ type: "openSheet", file: view.s.file })}>Layout sheet</button>
    </header>
    <main>
      <canvas bind:this={canvas} aria-label="panel in 3D"></canvas>
      {#if noGl}<div class="nogl">The 3D view needs WebGL, and this window has none: {noGl}</div>{/if}
      {#if tip}
        <div class="tip" style="left: {tip.x + 14}px; top: {tip.y + 14}px">
          {#each (tip.box.label ?? tip.box.id).split("\n") as line, i}
            <div class:strong={i === 0}>{line}</div>
          {/each}
        </div>
      {/if}
    </main>
    <aside>
      {#if picked && item(picked) && boxOf(picked)}
        {@const it = item(picked)!}
        {@const b = boxOf(picked)!}
        <h3>{it.tag}</h3>
        <p>{it.desc}</p>
        <dl>
          <dt>Part</dt><dd><button class="link" onclick={() => vscode.postMessage({ type: "reveal", file: `parts/${it.partId}.json` })}>{it.part?.catalog ?? it.partId}</button></dd>
          <dt>Size</dt><dd>{it.w} × {it.h} × {it.d} mm{it.sized ? "" : " (a guess)"}</dd>
          <dt>Depth</dt><dd>{depthLine(view.S, b)}</dd>
        </dl>
        {#each view.mine.filter((p) => p.find === `"device": "${picked}"`) as p}
          <p class={p.severity}>{p.message}</p>
        {/each}
      {:else}
        <h3>Enclosure</h3>
        <dl>
          <dt>Inside</dt><dd>{view.S.enclosure.d - view.S.enclosure.door - view.S.enclosure.panelFace} mm from the backpanel to the door</dd>
          <dt>Hinge</dt><dd>{view.S.enclosure.hinge}</dd>
          <dt>Parts</dt><dd>{view.L.items.length}</dd>
        </dl>
        <p class="muted">Hover a part to name it; click for its depth. Drag to turn, right-drag to pan, wheel to zoom.</p>
      {/if}
      <h4>Problems on this sheet</h4>
      {#each view.mine as p}
        {@const tag = /"device": "([^"]+)"/.exec(p.find ?? "")?.[1]}
        <button class="row {p.severity}" onclick={() => (picked = tag)}>{p.message}</button>
      {:else}
        <p class="muted">None.</p>
      {/each}
    </aside>
  </div>
{/if}

<style>
  .app3d {
    display: grid;
    height: 100vh;
    grid-template-columns: minmax(0, 1fr) 280px;
    grid-template-rows: auto 1fr;
    grid-template-areas: "head head" "main side";
  }
  header { flex-wrap: wrap; }
  /* Narrow (beside another editor): the panel goes under the picture. */
  @media (max-width: 760px) {
    .app3d { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr) minmax(0, 32vh); grid-template-areas: "head" "main" "side"; }
    aside { border-left: none; border-top: 1px solid var(--border); }
  }
  .nogl { position: absolute; inset: 0; padding: 2em; color: var(--muted); }
  canvas { display: block; width: 100%; height: 100%; touch-action: none; }
  aside { grid-area: side; border-left: 1px solid var(--border); }
  aside h3 { font-size: 15px; text-transform: none; letter-spacing: 0; color: var(--fg); }
  .views { display: inline-flex; gap: 2px; }
  button.off { opacity: 0.5; }
  .tip {
    position: fixed; pointer-events: none; z-index: 5;
    background: var(--vscode-editorHoverWidget-background, #252526); color: var(--fg);
    border: 1px solid var(--vscode-editorHoverWidget-border, #454545);
    padding: 4px 8px; border-radius: 3px; font-size: 12px; max-width: 320px;
  }
  .strong { font-weight: 600; }
  .error { color: var(--err); }
  .warning { color: var(--warn); }
  .row { white-space: normal; margin-bottom: 4px; }
</style>
