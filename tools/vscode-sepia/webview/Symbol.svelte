<script lang="ts">
  // NEMA symbols, drawn about (0,0) with ports where core/symbols.ts says.
  let { symbol }: { symbol: string } = $props();
</script>

{#if symbol === "nema/contact-no" || symbol === "nema/contact-nc" || symbol === "nema/ol-nc"}
  <line x1="-25" y1="0" x2="-6" y2="0" />
  <line x1="6" y1="0" x2="25" y2="0" />
  <line x1="-6" y1="-10" x2="-6" y2="10" />
  <line x1="6" y1="-10" x2="6" y2="10" />
  {#if symbol !== "nema/contact-no"}<line x1="-11" y1="11" x2="11" y2="-11" />{/if}
{:else if symbol === "nema/selector-no"}
  <line x1="-25" y1="0" x2="-11" y2="0" />
  <line x1="11" y1="0" x2="25" y2="0" />
  <circle cx="-8" cy="0" r="3" fill="none" />
  <circle cx="8" cy="0" r="3" fill="none" />
  <line x1="-12" y1="-7" x2="12" y2="-7" />
{:else if symbol === "nema/coil"}
  <line x1="-25" y1="0" x2="-12" y2="0" />
  <line x1="12" y1="0" x2="25" y2="0" />
  <circle cx="0" cy="0" r="12" fill="none" />
{:else if symbol === "plc/di" || symbol === "plc/do"}
  <rect x="-35" y="-12" width="70" height="24" fill="none" />
{:else}
  <rect x="-25" y="-10" width="50" height="20" fill="none" stroke-dasharray="3 3" />
  <text x="0" y="4" class="t-small" text-anchor="middle">?</text>
{/if}
