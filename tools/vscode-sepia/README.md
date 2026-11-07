# sepia for VS Code

The first slice of sepia: a `*.sheet.json` opens as a ladder drawing on an
ANSI B sheet, drawn from the project's files. `panel.json` says what's wired
to what. The sheet only says which line and column each piece sits on.
Wires, wire numbers, cross-references, line descriptions and the title
block are all computed from that data.

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

Open `sheets/01-pump-1-control.sheet.json`. It opens as a drawing; use
"Reopen Editor With… → Text Editor" to see the JSON.

### Things to try

1. **Drag a part** to another line or column. The wires re-route, and
   exactly one line of the sheet's JSON changes. Ctrl+Z undoes it. A drag
   never touches `panel.json`.
2. **Click a wire** (for example 302). It highlights everywhere it goes and
   lists its terminals in pull order. "Wire in panel.json" jumps to its
   line.
3. **Edit `panel.json` beside the drawing**, the way an agent would. Move a
   terminal to another wire, or rename wire `302A` to `310`. The drawing
   and the checks update as you type, before you save.
4. **Drag a spare contact** (CR101.no2, OL101.no) from the left panel onto
   a line. Delete removes the selected part from the sheet.
5. **Problems panel:** the SCCR error is real. 150 kVA at 2 %Z gives
   9.0 kA available, and the GH15ET contactors are only rated 5 kA. That's
   the PNL-P02 lesson.
6. **Print PDF** (the header button, or "sepia: Print Drawing Set to PDF")
   writes every sheet to one PDF. It's the same drawing as on screen.
7. Keys: **F** fits the sheet, **P** hides or shows the side panels, the
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
pieces; a terminal on two wires; open wires; two parts in one cell; lines
and columns out of range; a part drawn twice; wire numbers that don't follow
line numbering (302, 302A, 302B); and panel SCCR against the available fault
current computed from `sepia.json`'s `service` (transformer kVA and %Z).

## Not yet

- **The core is TypeScript, not Go.** `docs/design.md` §4 plans a Go core
  with an LSP. This slice keeps the core in one shared TypeScript module so
  it could ship quickly. It ports cleanly.
- Symbols are built in (`src/core/sheetDraw.ts`). Project symbols as JSON
  primitives come next.
- No cover sheet, BOM or wire list pages yet, and no panel layout or 3D, and no one-line, PLC I/O or
  network sheet types. Only ladder sheets.
- PLC input commons aren't modelled, so input boxes don't connect to the
  0 V rail. That's intended for now.
- From-to numbering for field wires isn't checked yet (there are no field
  wires in the example).
- The git revision is read on every refresh (three `git` calls). If typing
  in `panel.json` feels laggy, this is the first thing to cache.

## Tests

```sh
npm test                 # core: ops, canonical JSON, PDF draft vs issued
npm run check            # svelte-check
SEPIA_E2E_CODE=/usr/share/code/code xvfb-run -a node out/e2e/run.js   # real VS Code
```
