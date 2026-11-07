# sepia for VS Code

sepia opens a `*.sheet.json` as a drawing on an ANSI B sheet, drawn from
the project's files. `panel.json` says what's wired to what. The sheet only
says which line and column each piece sits on. Wires, wire numbers,
cross-references, line descriptions and the title block are all computed
from that data.

Two sheet kinds are placed by hand: **ladder** (rungs between two rails)
and **power** (three-phase branches hanging off a bus). Four are generated
from the data: **cover**, **bom**, **wires** and **terminals**. The
example, `examples/lift-station`, is the whole lift-station panel: a cover,
nine schematics (power, 120 VAC and 24 VDC distribution, both pumps'
control, inputs, outputs, analog), the bill of materials, the wire list and
the terminal plan. That's 16 pages.

## Try it

You need Node 20 or later.

```sh
cd tools/vscode-sepia
npm install
npm run build
```

Then either:

- **F5:** open `tools/vscode-sepia` in VS Code and press F5. The
  "sepia: lift-station example" launch opens a second window on
  `examples/lift-station`. F5 doesn't build. Run `npm run build` in a
  terminal first, or keep `npm run watch` running. (A pre-launch npm task
  fails over Remote-SSH when node comes from nvm, because the server's task
  shell never loads nvm.)
- **Install it:** run `npm run package`, then
  `code --install-extension sepia-0.0.1.vsix`, then open
  `examples/lift-station` as a folder.

Open `sheets/01-power.sheet.json` or `sheets/03-pump-1-control.sheet.json`.
It opens as a drawing; use "Reopen Editor With… → Text Editor" to see the
JSON. The left panel lists every sheet in the set.

### Things to try

1. **Power sheet:** drag a fuse or contactor to another branch or
   position; the bus and the motor-lead junctions re-route. Click wire
   `100L1` to see the bus light up.
2. **Drag a part** on a ladder sheet to another line or column. The wires re-route, and
   exactly one line of the sheet's JSON changes. Ctrl+Z undoes it. A drag
   never touches `panel.json`.
3. **Click a wire** (for example 302). It highlights everywhere it goes and
   lists its terminals in pull order. "Wire in panel.json" jumps to its
   line.
4. **Edit `panel.json` beside the drawing**, the way an agent would. Move a
   terminal to another wire, or rename wire `302A` to `310`. The drawing
   and the checks update as you type, before you save.
5. **Drag a spare contact** (CR101.no2, OL101.no) from the left panel onto
   a line. Delete removes the selected part from the sheet.
6. **Problems panel:** the SCCR error is real. 150 kVA at 2 %Z gives
   9.0 kA available, and the GH15ET contactors are only rated 5 kA. That's
   the PNL-P02 lesson.
7. **Numbering:** in `sepia.json`, change `"numbering"` to
   `{ "default": "from-to", "field": "from-to" }`. Every wire number on
   the drawings turns into the far terminal at each end, which is what the
   sleeves say. The wire list, terminal plan and cover note follow.
   `"default": "line"` puts it back. Field conductors follow `"field"`.
8. **Generated pages:** open the BOM, wire list or terminal plan. Rename a
   part's catalog number or add a wire in `panel.json` and they redraw.
9. **Panel layout** (`13-layout.sheet.json`): the backpanel and the door
   to scale, with every mounted part listed. Drag a DIN part along its
   rail or onto another rail; dropped on top of another part, it slides
   to the nearest free stretch. Drives, the transformer and the door
   operators move in 5 mm steps. Drag a drive up into the top duct and the
   Problems panel says how far into its 60 mm airflow clearance it went.
   Delete takes a part off; it shows under "Not mounted", and you can
   drag it back. The BOM now counts DIN rail and duct by the stick.
10. **Print PDF** (the header button, or "sepia: Print Drawing Set to PDF")
   writes every sheet to one PDF. It's the same drawing as on screen.
11. Keys: **F** fits the sheet, **P** hides or shows the side panels, the
   mouse wheel zooms, and dragging the background pans.

### Revisions from git tags

The example lives inside the sepia repo, so tagging it would tag the tool.
To see revisions work, copy it into its own repo:

```sh
cp -r examples/lift-station /tmp/ls1 && cd /tmp/ls1
git init && git add -A && git commit -m "first draft"
node <sepia>/tools/vscode-sepia/out/cli.js print .    # LS1-E-A-draft.pdf, stamped PRELIMINARY
git tag -a rev-A -m "Issued for review"
node <sepia>/tools/vscode-sepia/out/cli.js print .    # LS1-E-A.pdf: no stamp, and the rev block reads "A  Issued for review"
```

Change a tracked file after that and the next print is "B draft".
Untracked files, such as the PDFs themselves, don't count.

### For your agent

The agent edits the JSON files, then runs:

```sh
node tools/vscode-sepia/out/cli.js check examples/lift-station --json
```

It prints every problem with its file and a `find` string, and exits 1 if
there are any errors. `print` writes the PDF set:

```sh
node tools/vscode-sepia/out/cli.js print examples/lift-station -o set.pdf
``` (The `sepia` bin name will apply once the CLI is
published on its own.)

### Without VS Code

```sh
node scripts/harness.mjs ../../examples/lift-station
```

This writes `media/dist/harness-<sheet>.html`, which you can open in any
browser. It's a static snapshot: dragging works, but nothing is saved.

## What's checked

Parse errors; duplicate tags and wire numbers; unknown parts, terminals and
pieces; an assembly whose base or BOM part is missing; a terminal on two
wires; open wires; two parts in one cell; lines and columns out of range; a
symbol on the wrong kind of sheet (a 3-pole contactor on a ladder); a part
drawn twice; wire numbers that don't follow line numbering (302, 302A,
302B; 103L1 on a power branch); and panel SCCR against the available fault
current computed from `sepia.json`'s `service` (transformer kVA and %Z).
SCCR takes the lowest rating of any device, assemblies included. On a
layout sheet: parts that overlap each other, the duct or a rail; parts off
the end of their rail or off the backpanel or door; a drive's clearance
with something in it; a part mounted the wrong way (a DIN part screwed to
the backpanel); a part with no size; rails off the backpanel or under duct;
and every device in the enclosure that nobody mounted.

## Not yet

- **The core is TypeScript, not Go.** `docs/design.md` §4 plans a Go core
  with an LSP. This slice keeps the core in one shared TypeScript module so
  it could ship quickly. It ports cleanly.
- Symbols are built in (`src/core/sheetDraw.ts`). Project symbols as JSON
  primitives come next.
- No 3D view yet, and no network sheet. The layout has no auto-pack: an
  agent (or you) writes the mounts.
- Grounding conductors aren't modelled (the SPD's ground, the bonded X2 of
  the transformer, the ground bar).
- A few parts in the example have terminal names by function where the
  maker doesn't publish markings (Eaton HT800 blocks by position, the
  breakers, the flow meter). Their part files say so in `notes`.
- PLC input commons aren't modelled, so input boxes don't connect to the
  0 V rail. That's intended for now.
- The wire list follows `panel.json`'s pull order exactly; nothing
  suggests a better order yet.
- The git revision is read on every refresh (three `git` calls). If typing
  in `panel.json` feels laggy, this is the first thing to cache.

## Tests

```sh
npm test                 # core: ops, canonical JSON, PDF draft vs issued
npm run check            # svelte-check
SEPIA_E2E_CODE=/usr/share/code/code xvfb-run -a node out/e2e/run.js   # real VS Code
npm run build && npm run test:gestures   # the sheet editor under real mouse and keys
```

`test:gestures` loads the built webview in headless Chrome and drives it
with real pointer and key input over the DevTools protocol: drag a part on a
ladder and on a power sheet, drop on a taken cell, drag one in from Not
drawn, Delete, Escape mid-drag, select a wire, pan, zoom, page through the
wire list. Each drag checks that the drop target shown mid-drag is the cell
the op names and the cell the part is drawn in after the host applies it.
It needs Chrome on `PATH`; `GESTURE_CLIPS=<dir>` records each test to an
mp4. See [gesture-harness/README.md](gesture-harness/README.md).
