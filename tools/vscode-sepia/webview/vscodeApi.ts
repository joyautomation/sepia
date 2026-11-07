// The webview ↔ extension seam. Outside VS Code (the screenshot harness),
// posts collect on window.__POSTED__ and the project comes from
// window.__SEPIA__.

type Api = { postMessage(msg: unknown): void; getState?(): unknown; setState?(s: unknown): void };

declare global {
  interface Window {
    acquireVsCodeApi?: () => Api;
    __POSTED__?: unknown[];
    __SEPIA__?: unknown;
  }
}

export const vscode: Api = window.acquireVsCodeApi
  ? window.acquireVsCodeApi()
  : { postMessage: (msg) => (window.__POSTED__ ??= []).push(structuredClone(msg)) };
