// End-to-end: the extension in a real VS Code, on the lift-station example.
// Uses VS Code from $SEPIA_E2E_CODE (e.g. /usr/share/code/code) when set,
// else downloads one. Run under xvfb-run on a headless box:
//
//   npm run build && xvfb-run -a node out/e2e/run.js
//
// With SEPIA_E2E_SHOT=dir it pauses on the open sheet so a screenshot can be
// taken (the suite writes dir/ready, then waits for dir/done).

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { runTests } from "@vscode/test-electron";

async function main(): Promise<void> {
  const extRoot = path.resolve(__dirname, "..", "..");
  const example = path.resolve(extRoot, "..", "..", "examples", "lift-station");
  // Work on a copy: the suite edits panel.json.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sepia-e2e-"));
  const ws = path.join(tmp, "lift-station");
  fs.cpSync(example, ws, { recursive: true });
  try {
    await runTests({
      vscodeExecutablePath: process.env.SEPIA_E2E_CODE || undefined,
      extensionDevelopmentPath: extRoot,
      extensionTestsPath: path.join(__dirname, "suite.js"),
      launchArgs: [ws, "--disable-extensions", "--user-data-dir", path.join(tmp, "user"), "--skip-welcome", "--skip-release-notes", "--disable-workspace-trust",
        // Software WebGL for the 3D view, as the gesture harness uses.
        "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
      extensionTestsEnv: { SEPIA_E2E_WS: ws, SEPIA_E2E_SHOT: process.env.SEPIA_E2E_SHOT ?? "", SEPIA_E2E_SHOT_VIEW: process.env.SEPIA_E2E_SHOT_VIEW ?? "" },
    });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
