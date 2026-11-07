# Gesture harness

The sheet editor's and the 3D view's webviews under real input. It loads
the **production** `media/dist/sheet.js` (and `view3d.js`, in software
WebGL) in headless Chrome, plays the extension host's side of
the message protocol (`src/sheetEditor.ts`) with the lift-station example,
and dispatches real pointer and key events over the Chrome DevTools Protocol
(`Input.dispatchMouseEvent` / `dispatchKeyEvent`, not synthetic DOM events),
so pointer capture, hit-testing and focus behave as they do for a user.

The approach and `cdp.mjs`, `wait.mjs` and `clips.mjs` come from nautilus
(`tools/vscode-iec/webview-ui/gesture-harness`).

## Run

```sh
# from tools/vscode-sepia
npm run build           # out/ (the core the helpers call) and media/dist
npm run test:gestures
```

Needs Chrome or Chromium on `PATH` and Node 22 or later. No npm
dependencies. It isn't part of `npm test`, which stays browser-free.

Environment:

- `SEPIA_BUNDLE=<dir>`: test another build's `sheet.js` / `sheet.css` /
  `view3d.js` / `view3d.css`.
  Point it at a deliberately broken build to see a test go red.
- `HEADED=1`: a visible window.
- `GESTURE_CLIPS=<dir>`: record each test to `<dir>/<suite>/NN-<slug>.mp4`,
  listed with pass/fail in `<dir>/index.html`. Needs `ffmpeg`.
- `GESTURE_CPU_THROTTLE=<n>`: slow the page n times, to shake out timing.

## Files

| file | role |
|------|------|
| `host.html` | Stands in for the webview shell. Loads the bundle; `window.__*` helpers only read the page (sheet↔screen mapping, drop target, ghost, panels). |
| `helpers.mjs` | `Editor`: open a sheet, deliver a project, drag, click, press keys, read the posted ops. `commit()` applies an op the way the host does and returns the project it would send next; `cell()` gives a cell's centre from the same layout the webview draws. |
| `sheet.test.mjs` | Ladder, power and generated sheets: drag, drop on a taken cell, Not drawn, Delete, Escape, select, pan, zoom, fit, paging. |
| `layout.test.mjs` | The panel layout: a DIN part along and across rails, onto another part (it slides to free rail), a door operator, Delete, Not mounted, a drop off every rail. |
| `host3d.html` | The 3D view's shell. The bundle itself exposes `window.__view3d` (read-only: a box's screen point, the hover text, the picked part, the door). |
| `view3d.test.mjs` | The 3D view: hover names a part, a click shows its depth, the door swings its operators, an op and a shallower enclosure redraw and re-check. `Viewer3D` in `helpers.mjs` drives it. |
| `cdp.mjs`, `wait.mjs`, `clips.mjs` | Chrome over CDP, waiting on the page rather than the clock, clip recording. |

## Adding a case

Reproduce the gesture with `Editor`, then assert on the posted ops
(`ed.ops()`, `ed.warnings()`) or on what's drawn. For a drag, also check
the preview against the commit: read the drop target mid-drag (`mid`), then
`ed.deliver(commit(...))` and check the part is drawn there. Wait for what
you assert on (`opsPosted`, `waitUntil`); a fixed sleep is only for proving
nothing happened. When you fix a bug, first see the new test fail against
the old bundle (`SEPIA_BUNDLE=`).
