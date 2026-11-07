# QElectroTech: what it does, what it's missing

Status: Part A comes from reading QElectroTech's files (Claude, 2026-11-06).

**James, 11-06: sepia is a different kind of tool.** QElectroTech is drafting
software. A person places every symbol and draws every wire, and the menus
exist to make that work bearable. sepia works like our HMI editor: the AI
drafts the panel from a spec and a person adjusts it. So a feature-by-feature
comparison isn't the point. Part B shrinks to a ten-minute look, enough for
one honest line in the lesson ("this is drawing it by hand; here's
describing it instead"). The checklist stays as a reference for which
drafting outputs (PDF, BOM, wire list, terminal plan) sepia must still
produce.

Version: QElectroTech 0.100 from Flathub (`org.qelectrotech.QElectroTech`,
installed with `flatpak install --user`). Run it with
`flatpak run org.qelectrotech.QElectroTech`.

Paths below are relative to
`~/.local/share/flatpak/app/org.qelectrotech.QElectroTech/current/active/files/share/qelectrotech/`.

## A. What the files show (checked)

### What it does well

- **A large symbol library**: 8,597 elements under `elements/`, sorted by
  function (`10_allpole/310_relays_contactors_contacts`,
  `130_terminals_terminal_strips` and so on), plus a manufacturer folder
  (`20_manufacturers_articles/`: ABB, Allen-Bradley, and others).
- **Multi-page projects**: `examples/industrial.qet` has 50 sheets (`<diagram>`).
- **Cross-references between sheets**: elements are master or slave
  (`link_type="master"` on a coil), and a coil links to its contacts on other
  sheets by `<link_uuid>` (e.g. `industrial.qet:689`).
- **Automatic wire numbering by formula**: `formula="%id%seqt_1"` on a
  conductor (`industrial.qet:948`).
- It's GPL, runs on Linux, Windows and Mac, and is actively released (0.100).

### Where it conflicts with our design principles

1. **Meaning and position are in the same record.** One `<element>` holds
   both what the part is (`type`, `uuid`) and where it sits on the sheet
   (`x`, `y`, `orientation`, `z`) (`industrial.qet:422`). One `<conductor>`
   holds `terminal1="28" terminal2="30" num="423"` next to its `<segment>`
   geometry, fonts, text rotation and colours (`industrial.qet:948`, ~25
   attributes). Moving a symbol changes the same lines as rewiring it, so a
   git diff can't read as "wire 104 added, K1:13 → X1:5".
2. **Wires refer to terminals by internal number, not by name.** `terminal1="28"`
   is a numeric id within the file, not `K1:A1`. In the library, **33,755
   terminals have an empty name and 7,129 have one** (e.g. the AC coil
   `10_allpole/310_relays_contactors_contacts/01_coils/comm_insens_au_courant_alter.elmt`
   has two terminals with `name=""`, not A1/A2). You can't write or review a
   wire list from the file.
3. **Derived values are stored.** Each element and conductor carries
   `<sequentialNumbers>` (auto-numbering state). The generated label is
   saved as well: `num="423"` next to `formula="%id%seqt_1"`
   (`industrial.qet:948`). We'd derive these, not store them.
4. **One large XML file per project.** `industrial.qet` is 2.6 MB, and every
   symbol it uses is embedded in it (`type="embed://import/..."`). Two people
   editing different sheets edit the same file.
5. **Parts have no ratings.** An element's data is free text:
   `manufacturer` (on 2,921 of 8,597 elements), `designation`, `description`,
   `label`, `comment`, `quantity`, `manufacturer_reference` (on only 54) and a
   few others. No field holds an electrical rating. There's nowhere to put
   FLA, SCCR, heat dissipation or coil current, so the checks the lessons
   teach (SCCR, supply load, transformer VA) can't run.
6. **Almost no US symbols.** `elements/10_electric/90_american_standards/` has
   **4 elements**: a circuit breaker and three connector pins. The library is
   IEC 60617. US ladder drawing with NEMA symbols means drawing your own.
7. **No panel layout or 3D from the same model.** Nothing in the format places
   a part on a backpanel or DIN rail, or refers to a 3D model.

## B. The hour (James)

### What to draw

Draw a thin slice of the lift-station panel that touches what PNL-F03 to
PNL-F10 teach. **The numbers are placeholders** (`plant.md` doesn't exist
yet), so don't let them carry into anything else.

1. Incoming 480 V 3-phase *(placeholder)* → main disconnect.
2. Control transformer 480/120 V *(placeholder)* with primary and secondary
   fuses.
3. 24 VDC power supply from 120 V.
4. Pump 1 starter: branch protection, contactor M1, overload OL1, and a
   hand-off-auto switch with the PLC output in auto.
5. An E-stop in the control string.
6. One PLC digital input (M1 auxiliary contact, "pump 1 running").
7. The wet-well level transmitter, a 4–20 mA loop-powered input to the PLC.
8. A terminal strip for field wiring (the motor leads, the transmitter and the
   float).

### Checklist

Mark each yes, partial or no, with a note. Each line maps to one of our
design principles.

| # | Try this | Principle | Result | Note |
|---|---|---|---|---|
| 1 | Draw US ladder with line numbers down the side; coil M1 shows the line numbers of its contacts | US ladder, line-number xrefs | | |
| 2 | Find NEMA symbols for a contactor, overload, HOA and E-stop; time how long it takes to make any that are missing | US symbols | | |
| 3 | Wires named A1, A2, 13, 14 on the parts; does the wire list say `M1:A1`? | panel is data | | |
| 4 | Number the wires (100s per page, or by line), renumber after inserting a rung | derived, not stored | | |
| 5 | Make a terminal plan for the field strip (recent versions have a terminal strip editor; check it) | derived outputs | | |
| 6 | Export the BOM and the wire list as CSV | outputs | | |
| 7 | Export the drawing set as PDF; try DXF | outputs | | |
| 8 | Set a rating on a part (FLA, SCCR, VA) and see whether anything checks it | ratings, checks | | |
| 9 | Draw the backpanel layout (DIN rail, wire duct), linked to the same parts | one model, many views | | |
| 10 | Commit, move M1 two grid squares, commit, run `git diff` | merge-friendly | | |
| 11 | Add one wire, run `git diff`: can you read what changed? | merge-friendly | | |
| 12 | Edit the `.qet` by hand (rename a wire) and reopen it | text escape hatch | | |

### Notes as you go

What took longer than it should, what was pleasant, what a student would trip
on.

### Verdict

One paragraph, for the lesson script: what QElectroTech is good for, and why
it isn't enough for this panel.
