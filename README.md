# sepia

Open-source electrical and control-panel CAD that runs in VS Code. It makes
schematics, panel layout, a 3D panel, the BOM and the wire list from text
files that live in git.

**Status: design.** No code yet. Start with [docs/design.md](docs/design.md).

- **The panel is data; drawings are views of it.** Devices and the physical
  wiring live in one file, and every sheet, the backpanel, the 3D model, the
  BOM and the wire list are generated from it.
- **Built like the [nautilus](https://github.com/joyautomation/nautilus) HMI
  editor.** Symbols are Svelte components, and wires are autorouted
  connections between terminals.
- **The AI drafts it; people adjust it.** Describe the panel, check what the
  AI drew, and drag or swap what's wrong. Title blocks, line numbers,
  cross-references and revisions are filled in from data and git tags.
- **US ladder drawings first** (NFPA 79 / UL 508A practice); IEC later.

Its first job is the duplex lift-station panel used in Joy Automation's
control-panel lessons. Features get built when a lesson needs them.

## License

Apache 2.0, the same as nautilus.
