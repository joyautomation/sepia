# sepia: design

Draft 2, 2026-11-06. Rewritten after James's direction the same day: sepia is
built like the nautilus HMI and mimic editors, but its output looks like a
CAD drawing set. Items marked **Decide** need his call.

## 1. What it is

sepia is a panel drawing tool that works like our HMI editor:

- **Symbols are components.** A contactor coil, an N.O. contact, an overload,
  a fuse or a terminal is a Svelte component with named connection points
  (its terminals), just as `FloatSwitch.svelte` with its `.component.json`
  is in the lift-station HMI. Styling comes from tokens, so the whole drawing
  set restyles in one place.
- **Wires are connections**, like mimic pipes: from one terminal to another,
  routed orthogonally and automatically. Nobody draws arrows.
- **The AI does the first draft; people tweak it.** You give the AI the spec
  ("duplex lift station, two 10 hp pumps, 480 V, HOA, E-stop, level
  transmitter"). It writes the panel files, the core checks them, and the
  views show the result. You drag, swap and fix what's wrong. Anything bigger,
  you ask for.
- **The drafting parts are data, not choices.** Sheet size, borders, the
  title block, revision blocks, line numbers and cross-references are fixed
  by the template. You fill in the project's data (name, drawing number,
  revision, who drew it), and it shows up in the right place on every sheet
  of the PDF. There's no title-block editor.

**Variants** (James 11-06). The lift station has one reference panel and
several variants: across-the-line starters instead of VFDs, Local-Off-Remote
instead of HOA, and so on (`content/library/plant.md`, Variants). A variant
starts as a full copy of the project that the AI makes from the reference
plus an instruction ("same station, L-O-R with start/stop pushbuttons"). A
variant that inherits from the reference ("extends") waits until keeping
copies in sync gets painful.

There's a deliberately short list of things a person does by hand: move a
symbol, move a part on the backpanel, swap a part, edit a value, and accept
or reject what the AI did. Everything else is generated or derived.

## 2. Principles

1. **The panel is data; drawings are views of it.** Devices, their parts and
   the wires are stored once. A sheet only says where pieces are drawn. A
   device appears on several sheets (coil on one, contacts on two others)
   and is still one device.
2. **Derived things are never stored.** Cross-references, line numbers, the
   BOM, the wire list, terminal plans, sheet x of y, and load totals are all
   computed.
3. **Canonical files.** Tools write files in a fixed key order with one record
   per line where it fits, so a diff reads "wire 104 added, M1:14 → PLC1:I-00"
   and two branches merge.
4. **Checks are the AI's feedback loop as much as yours.** The core flags a
   wire to a terminal the part doesn't have, a duplicate wire number, a
   wire with one end, an overloaded supply or an SCCR shortfall. The AI fixes
   these before you look, and anything left shows as squiggles.
5. **Bring your own agent; no AI inside sepia** (James 11-06). sepia never
   embeds a model or a chat. Whatever agent the user runs (Claude Code or
   any other) drafts by editing the files. sepia's job is to make that safe
   and fast: strict schemas, a `sepia check` command with machine-readable
   output, and a live preview. The same tool works with no AI at all.
6. **The host is glue.** The model, checks and rendering run without VS Code,
   so the tool can later run in a browser.
6. **US ladder drawings first** (NFPA 79 / UL 508A practice). IEC 60617 /
   81346 come later.

## 3. Files

A panel project is a folder, the way an HMI project is:

```
lift-station-panel/
  sepia.json                  project data: title block fields, revisions, sheet size, wire classes
  panel.json                  devices and wires (the electrical meaning)
  sheets/
    01-cover.sheet.json        generated sheets (cover, one-line, BOM, wire list) only say "include me"
    03-pump-1.sheet.json       ladder sheets: which piece is on which line
    13-layout.sheet.json       the backpanel and door: rails, duct, where each device is mounted
  parts/                      project-local parts (the shared library is its own repo)
  symbols/                    project-local symbols (.svelte + .symbol.json)
```

JSON throughout, like `*.mimic.json`, `*.scene.json` and `*.kind.json`.
That keeps one family of formats and one canonical writer, and VS Code
validates every file against a schema for free. (Draft 1 proposed a custom
text format. With the AI writing the files, consistency with the HMI
formats matters more than hand-typing.)

### 3.1 `panel.json`: devices and wires

**Every number and part id is a placeholder** until `plant.md` is written.

```json
{
  "devices": [
    { "tag": "M1",   "part": "ab/100-c09d10",          "desc": "Pump 1 contactor" },
    { "tag": "OL1",  "part": "example/overload-3-12a", "desc": "Pump 1 overload", "set": { "fla": 7.6 } },
    { "tag": "PB1",  "part": "example/estop-1nc",      "desc": "Emergency stop" },
    { "tag": "PLC1", "part": "example/plc-di-do-ai",   "desc": "Pump controller" },
    { "tag": "SS1",  "part": "example/hoa-2no",        "desc": "Pump 1 hand-off-auto" },
    { "tag": "T1",   "part": "example/cpt-250va",      "desc": "Control transformer" },
    { "tag": "X1",   "part": "example/terminal-2.5mm", "desc": "Field terminals", "count": 20 }
  ],
  "wires": [
    { "no": "2",   "class": "ctl120", "run": ["FU2:2", "PB1:11"] },
    { "no": "3",   "class": "ctl120", "run": ["PB1:12", "SS1:1", "PLC1:OCOM"] },
    { "no": "4",   "class": "ctl120", "run": ["PLC1:O-00", "SS1:3"] },
    { "no": "5",   "class": "ctl120", "run": ["SS1:2", "SS1:4", "OL1:95"] },
    { "no": "6",   "class": "ctl120", "run": ["OL1:96", "M1:A1"] },
    { "no": "104", "class": "dc24",   "run": ["M1:14", "PLC1:I-00"] }
  ]
}
```

- A **wire number is one potential** (US practice). `run` lists the
  terminals in the order the wire is pulled, so the wire list gets every
  from-to pair. Each wire is one line in the file, so adding wire 104 is a
  one-line diff.
- **Wire classes** (in `sepia.json`) give the colour and gauge: for example
  `ctl120` is red 16 AWG and `dc24` is blue. They're set once per project.
  **Decide:** the default class table for the lessons.
- **Wire numbering is a project option** (James, 11-06), and it can be set
  differently per wire class:
  - `line`: the wire takes the line (rung) number where it starts, with a
    suffix when one line has several (302, 302A). On a power sheet the
    branch number takes the phase or terminal instead (103L1, 103U,
    103T1). Incoming conductors keep their phase names (L1, L2, L3, N).
  - `from-to`: each end of the wire is marked with the terminal at the
    other end (`X1:5` at the PLC, `PLC1:I-00` at the strip). This is common
    for external connections.
  A number is assigned once and then stored, because it's printed on a
  sleeve and can't change silently. The scheme decides what a *new* wire
  gets, and renumbering is an explicit command.
- **Built 11-07: the scheme applies per conductor.** A wire is one
  potential; its run, in pull order, is a chain of conductors, each cut and
  sleeved on its own. A conductor with an end on a field device follows
  `numbering.field`, and every other follows `numbering.default`. So
  `{ "default": "line", "field": "from-to" }` numbers the panel by line and
  marks field cables from-to, and `{ "default": "from-to" }` marks every
  conductor with its far end, which helps when troubleshooting inside the
  panel (James, 11-07). The drawings print the far end beside each
  conductor's end (up the wire on a power sheet). The wire list shows both
  sleeves of every conductor either way. The wire number stays in
  `panel.json` as the potential's name, and the line-numbering check only
  applies to wires that print it.

### 3.2 Sheets: like a mimic, without the pipes

**The panel file holds physical connections. The sheets follow from it.**
`panel.json` says what's wired to what. Every sheet is a view chosen to show
part of that, and the sheet types decide how.

**Sheet types** (James, 11-06; the list follows EPLAN's page types, cut to
what a US panel set uses). Each type is a template. Only the ones a lesson
needs get built:

| Type | Placement | Content | First lesson |
|---|---|---|---|
| Cover | none | generated: title, sheet index, notes, PE stamp | PNL-F02 |
| Power (three-line) | branch and position | incoming power, disconnect, bus, branches, drives, transformer | PNL-F03 |
| Motor control (ladder) | line and column | rungs between L1/L2 rails, line numbers, cross-references | PNL-F02, F07 |
| Control power distribution | ladder | 120 VAC and 24 VDC fan-out, fuses, commons | PNL-F03 |
| PLC I/O | per module, per point | a module as a box with one row per point, field device and wire per row | PNL-F08, F09 |
| Network | free | switches, PLC, HMI, ports and cables, IP addresses | NET lessons |
| Panel layout | rails and duct | backpanel and door, to scale, tags on parts | PNL-F11 |
| Terminal plan | generated | each strip: terminal, inside wire, outside wire, cable | PNL-F06 |
| Field wiring (interconnect) | generated | cables from the panel to field devices, conductors | PNL-F09 |
| BOM | generated | grouped by part, quantity, tags | PNL-F02 |
| Wire list | generated | wire number, from, to, class, colour, gauge | PNL-F02 |
| Free | free x/y | anything else (details, notes, nameplates) | as needed |

Each placed type puts **pieces** of devices on the sheet. Generated types have
no placement at all.

A ladder sheet places **pieces** of devices on numbered lines. The wires
between them aren't stored on the sheet. They come from `panel.json`, and the
renderer routes them between the pieces' terminals, the way the mimic editor
autoroutes a pipe between two ports.

```json
{
  "title": "Pump 1 control",
  "kind": "ladder",
  "lines": [300, 319],
  "place": [
    { "piece": "PB1.nc",    "line": 302, "col": 1 },
    { "piece": "SS1.hand",  "line": 302, "col": 2 },
    { "piece": "OL1.nc",    "line": 302, "col": 3 },
    { "piece": "M1.coil",   "line": 302, "col": 9 },
    { "piece": "PLC1.O-00", "line": 303, "col": 1 },
    { "piece": "SS1.auto",  "line": 303, "col": 2 }
  ]
}
```

- **Placement is a line and a column on the ladder grid, not free x/y.**
  That's what makes a sheet look like a drawing and not a diagram. It also
  makes line numbers and cross-references come out right: the coil at line
  302 prints the lines of its contacts, wherever they're placed.
- If a sheet leaves a piece out, it isn't drawn. If two sheets place the same
  piece, the core flags it.
- Generated sheets only say which kind they are: `{ "title": "Wire list",
  "kind": "wires" }`. Their content comes from the data. Built 11-07:
  `cover` (sheet index, general notes from the service, SCCR and numbering
  plus `sepia.json` `notes`, wire classes), `bom` (assemblies expanded,
  totalled by part, field devices apart), `wires` (every conductor and both
  of its sleeves) and `terminals` (each strip: inside and outside ends). A
  long one runs to several pages. Pages are numbered across the set, and
  the cover isn't numbered, so the first schematic is sheet 1 and its lines
  can start at 100.

**Power sheets (built 11-07) are the ladder turned 90°.** A line is a
vertical branch and `col` counts positions down it (six by default), so
the placement format, the editor's drag and the checks are the same as a
ladder's. Power symbols have one pole per phase, line terminals on top and
load terminals underneath, and pole 1 always sits in the same place. So a
2-pole fuse lines up with phases 1 and 2 of a 3-pole contactor below it.
Wires whose ends line up drop straight down. Anything else (the bus under
the main disconnect, the motor leads where the bypass rejoins the drive
output) runs on a horizontal track in the gap under its highest end, with
the tracks stacked L1 over L2 over L3. A branch's caption comes from what
it feeds, and the sheet can override it with `notes`. Because a coil's
cross-reference counts the power contacts too, it reads "103 305 600"
(power branch, interlock, aux).

**Layout sheets (built 11-07) replace `backpanel.json`.** A `kind:
"layout"` sheet gets the editor, the ops queue, live checks, printing and
page numbering that every sheet already has, which a separate file would
have needed again. It draws the backpanel and the door side by side, to a
standard scale (1:4 to 1:20, the smallest that fits), with a table of
every mounted part. Everything is in mm. The sheet names the `enclosure`
device and lists DIN rails (`din`: id, x, centreline y, length), wire duct
(`duct`: x, y, w, h) and where each device is mounted (`mount`). A mount
is `{ "device", "on", "x", "y" }`, and `on` says what it's on: a rail id
(x along it), `"door"`, `"top"`/`"left"`/`"right"` (outside the
enclosure), another device's tag (an overload under its contactor), or
nothing (screwed to the backpanel). Sizes come from the part's
`mount.size_mm` (width along the rail, height, depth), the enclosure's from
`enclosure.size_mm`, and the backpanel's from `panel.size_mm` on a part in
the enclosure's BOM. A part's `mount.clearance_mm` (a drive's airflow) is
drawn dashed and checked. Rails and duct with a `part` are totalled into
the BOM by the stick. In the editor a DIN part snaps to the nearest rail
and slides to the nearest free stretch of it. Anything else moves in 5 mm
steps and stays on its face. The checker reports overlaps, parts off a rail
or the backpanel, clearances, the wrong kind of mount and devices nobody
mounted, with the numbers in each message.

### 3.3 Parts and symbols

**A part is a real product** (catalog number, terminals, ratings, size, 3D
model). **A symbol is a drawing** (drawing data; see below). A part says which
pieces it has, and which symbol and terminals each piece uses:

```json
{
  "id": "ab/100-c09d10",
  "manufacturer": "Allen-Bradley",
  "catalog": "100-C09D10",
  "desc": "IEC contactor, 9 A, 120 VAC coil, 1 N.O. aux",
  "pieces": {
    "coil":  { "symbol": "nema/coil",       "terminals": ["A1", "A2"] },
    "power": { "symbol": "power/contact",   "terminals": ["1/L1", "2/T1", "3/L2", "4/T2", "5/L3", "6/T3"] },
    "aux1":  { "symbol": "nema/contact-no", "terminals": ["13", "14"] }
  },
  "ratings": {
    "coil":  { "volts": "120VAC", "inrush_va": null, "sealed_va": null },
    "sccr":  [ { "ka": null, "with": "…" } ],
    "heat_w": null
  },
  "mount": { "din": "35mm", "size_mm": [45, 81, 93] },
  "model": { "glb": null, "step": "https://… (manufacturer)" }
}
```

**Assemblies (11-07).** What gets drawn is often more than one catalog
item: a selector with two extra gold contact blocks, a fuse holder with its
fuses, a relay on its socket. An assembly part names a `base` and a `bom`.
It takes the base's pieces and ratings, adds its own pieces (the gold
blocks' contacts), and the BOM lists what's actually bought. The device
points at the assembly, so the base part file stays a true catalog item.

**Repeated pieces.** An I/O module's sixteen inputs are one entry:
`"di{n}": { "symbol": "plc/di", "terminals": ["DI{n}"], "count": 16,
"from": 0 }`. A terminal strip works the same way.

Ratings are left null here on purpose; they come from datasheets. A check
that needs a missing rating reports "unknown", not "pass". The ratings
listed are the ones the lessons calculate with: coil VA (PNL-F12),
supply current, FLA, SCCR with its conditions (PNL-P02) and heat (PNL-P03).

**Changed 11-06 (first slice): a symbol is drawing data, not a `.svelte`
file.** A symbol is a few primitives (lines, circles, rectangles, paths,
text) drawn about its origin, plus port positions in terminal order
(`["1", "2"]` for a contact), so the part's terminal names land on them.
The editor and `sepia print` draw the same list, which makes the PDF the
screen by construction, and an agent can write a new symbol as JSON. The
built-in NEMA symbols live in `core/sheetDraw.ts` and `core/symbols.ts`.
Project symbols (`symbols/*.symbol.json`, the same primitives) come next.
Interactive things (selection, drag, hit areas) are a layer over the ink in
the webview, not part of the symbol.

### 3.4 `sepia.json`: project data and the template

```json
{
  "project": "Lift Station LS-1 Control Panel",
  "drawing": "LS1-E",
  "client": "Joy Automation library",
  "people": { "drawn": "J. Joy", "checked": "", "approved": "" },
  "seal": { "engineer": "", "license": "", "state": "" },
  "sheet": "ansi-b",
  "template": "joy-standard",
  "numbering": { "default": "line", "field": "from-to" },
  "wireClasses": { "ctl120": { "color": "red", "awg": 16 }, "dc24": { "color": "blue", "awg": 18 } }
}
```

The template (a Svelte component: border, zone grid, title block, revision
block, PE stamp area) reads these fields. "Sheet 3 of 12" and the page's
title come from the sheet list. Nobody positions any of it. We start with one
standard title block: drawn, checked and approved by, the PE stamp area,
revision, date, drawing number, sheet x of y.

**Revisions come from git** (James, 11-06), the way software releases do:

- An issued revision is a git tag, for example `rev-A` or `rev-B`. The tag's
  date and message fill the revision block ("B, 2026-12-01, Issued for
  construction").
- Printing from a tagged commit gives that revision. Printing from anything
  else gives a draft, stamped "PRELIMINARY: NOT FOR CONSTRUCTION", with the
  next revision letter and the commit (`B draft, 3f2c1a9`).
- Revision clouds (marking what changed since the last issue) can come later
  from `git diff rev-A` against `panel.json`, since the format is built for
  readable diffs.

## 4. Architecture

```
  Go core (cmd/sepia)                      webview-ui (Svelte 5 + Vite)
  ─────────────────────                    ────────────────────────────
  load + validate project                  <Sheet>, <Ladder>, <TitleBlock>
  checks → LSP diagnostics                 symbol components (nema/*)
  derived: xrefs, line numbers,            autoroute (from the mimic editor)
    BOM, wire list, terminal plan          backpanel 2D, 3D (Threlte / hmi-3d)
  canonical writer + structural ops        print: same display list → PDF
        │  sepia lsp · sepia derive · sepia edit   │
        └──────────── thin VS Code host ───────────┘
```

**Copied from nautilus `tools/vscode-iec`:**

- The files are the source of truth. A gesture becomes a structural op, a
  canonical writer turns it into a `WorkspaceEdit`, and undo works. Ops are
  queued, and the webview waits for the ready handshake.
- A custom editor per file type, with a separate Vite bundle for the 3D view,
  so three.js stays out of the sheets.
- The Go binary (`sepia lsp`, `sepia derive`, `sepia edit`) is found or
  installed the way `naut` is.
- The mimic editor's autoroute, ports and gestures
  (`webview-ui/src/mimic/autoroute.ts`, `ports.ts`, `portsGestures.ts`).
  Once a second user needs them, they move into a shared package with the HMI.

**Rendering and printing: one display list** (changed 11-06, first slice).
`core/sheetDraw.ts` turns a sheet into primitives (the frame, the title
block and the ladder). The webview renders them as SVG, and `sepia print`
writes them as PDF with a hand-written PDF 1.4 writer (adapted from
nautilus PR #557) using the built-in Helvetica faces. So there's no browser,
no PDF library and no Svelte server-side render. The earlier plan
(Svelte SSR → SVG → SVG-to-PDF) would have needed an SSR bundle, an SVG
parser and inline styles for something the display list gets for free.

- **Print:** `sepia print [dir] [-o file.pdf]` or "sepia: Print Drawing Set
  to PDF" writes every sheet, one page each, named by drawing number and
  revision (`LS1-E-A.pdf`, `LS1-E-B-draft.pdf`).
- **Text measurement** uses Helvetica's published widths, and the screen
  asks for Helvetica or Arial, which share them, so anchored text lines up
  the same in both.
- **The title block** is one function (`drawFrame` in `core/sheetDraw.ts`),
  filled from `sepia.json`, git and the sheet list.
- **Derived data** (xrefs, BOM, wire list) is computed by the Go core and
  handed to the components as props, so the sheet and the CSV can't
  disagree.

## 5. Milestones

**Before milestone 1: `plant.md`.** The device list, voltages and pump
sizes come from it.

### Milestone 1: PNL-F01, the backpanel in 3D

The lesson's job is "Name every part in the lift-station panel and say what
it's for."

- `panel.json` with the lift-station devices (wires can be present and
  aren't checked yet). About 15 part files with sizes, and a layout sheet
  with rails, duct and mounts.
- **Auto-layout:** the AI or the core packs the parts onto rails. You drag
  them along a rail to adjust, which writes the offset.
- **3D view:** enclosure, backpanel, DIN rail, wire duct and parts (boxes
  from their sizes; one or two real STEP → glTF imports via occt-import-js
  to prove the path). Hover shows tag, description and part. The camera can
  be scripted for screen takes.
- Diagnostics: unknown part, duplicate tag, a mount with no device.

### Milestone 2: PNL-F02, the drawing set as PDF

- The template (border, title block, revisions) filled from `sepia.json`.
- About ten NEMA symbol components.
- Ladder sheets with line numbers, autorouted wires and coil-to-contact
  cross-references. The backpanel as a 2D sheet. BOM and wire list sheets,
  and also as CSV.
- `sepia print` → PDF. Wire checks become live diagnostics.

Later lessons add features as they need them: PNL-F06 numbering schemes and
terminal plans, PNL-F12 load totals and supply/transformer checks, PNL-F13
build order in 3D, and PNL-P02/P03 SCCR and heat.

**Engineering checks** (James 11-06: the tooling should help decide these):
SCCR against the available fault current (an input from the utility
transformer and cable), CPT and supply sizing from the load totals, heat
load against cooling, and 3D clearances. Each is a deterministic
calculation that runs as a check, with the arithmetic shown in the message.
The assumptions in `examples/lift-station/parts.md` are their first specs.

## 6. Open questions for James

Answered 11-06: sheet types (§3.2), wire numbering by line or from-to
(§3.1), the title block and revisions from git tags (§3.4), and `plant.md`
(being drafted).

1. The default wire classes, colours and gauges for the lessons.
2. STEP licensing: most manufacturers don't allow redistributing their
   models. Ship boxes and links, and have each user import STEP files
   locally?
