import type { Prim } from "../src/core/draw.ts";

/** What a drag would do if released now: the drop target's outline and
 * the piece drawn there, about `at`. Sheet units. */
export type Preview = { rect: { x: number; y: number; w: number; h: number }; at: { x: number; y: number }; items: Prim[] };

export type Sel = { kind: "piece"; ref: string } | { kind: "wire"; no: string } | { kind: "device"; tag: string } | null;
