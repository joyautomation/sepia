// Display list → PDF, written by hand (adapted from nautilus
// tools/vscode-iec/webview-ui/src/export/pdf.ts, Apache-2.0). Lines,
// rectangles, circles, paths and text are a dozen PDF 1.4 operators, and the
// built-in Helvetica faces need no embedding, so there's no PDF library and
// no browser: the same bytes come out of the CLI and the extension.

import { INK, textLeft, type Prim, type Stroke } from "./draw.ts";

const K = 0.5522847498; // a quarter circle's cubic control distance
/** Sheet units (1/100 in) to PDF points. */
const PT = 0.72;

function n(v: number): string {
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? "0" : String(r);
}

function rgb(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  const v = m ? parseInt(m[1], 16) : 0;
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => n(c / 255)).join(" ");
}

const WIN_ANSI: Record<string, number> = { "–": 0x96, "—": 0x97, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "…": 0x85 };
const ASCII: Record<string, string> = { "→": "->", "←": "<-", "≥": ">=", "≤": "<=", "√": "sqrt" };

/** A string as a PDF literal in WinAnsi: escaped, one byte per character. */
export function pdfString(s: string): string {
  let out = "(";
  for (const ch of s) {
    if (ASCII[ch]) {
      out += ASCII[ch];
      continue;
    }
    let code = ch.codePointAt(0)!;
    if (code > 0xff || (code >= 0x80 && code < 0xa0)) code = WIN_ANSI[ch] ?? 0x3f;
    if (code === 0x28 || code === 0x29 || code === 0x5c) out += "\\" + String.fromCharCode(code);
    else if (code < 0x20) out += " ";
    else out += String.fromCharCode(code);
  }
  return out + ")";
}

function strokeOps(s: Stroke): string {
  return `${rgb(s.color ?? INK)} RG ${n(s.width ?? 1)} w [${(s.dash ?? []).map(n).join(" ")}] 0 d`;
}

function paint(fill: string | undefined, s: Stroke | undefined, ops: string, closed: boolean): string {
  if (!fill && !s) return "";
  let out = "";
  if (fill) out += `${rgb(fill)} rg `;
  if (s) out += strokeOps(s) + " ";
  out += ops + " ";
  if (fill && s) out += closed ? "b" : "B";
  else if (fill) out += "f";
  else out += closed ? "s" : "S";
  return out;
}

export function primToPdf(p: Prim): string {
  switch (p.t) {
    case "line":
      return paint(undefined, p.s, `${n(p.x1)} ${n(p.y1)} m ${n(p.x2)} ${n(p.y2)} l`, false);
    case "rect":
      return paint(p.fill, p.s, `${n(p.x)} ${n(p.y)} ${n(p.w)} ${n(p.h)} re`, true);
    case "circle": {
      const { cx, cy, r } = p;
      const k = r * K;
      const ops = [
        `${n(cx + r)} ${n(cy)} m`,
        `${n(cx + r)} ${n(cy + k)} ${n(cx + k)} ${n(cy + r)} ${n(cx)} ${n(cy + r)} c`,
        `${n(cx - k)} ${n(cy + r)} ${n(cx - r)} ${n(cy + k)} ${n(cx - r)} ${n(cy)} c`,
        `${n(cx - r)} ${n(cy - k)} ${n(cx - k)} ${n(cy - r)} ${n(cx)} ${n(cy - r)} c`,
        `${n(cx + k)} ${n(cy - r)} ${n(cx + r)} ${n(cy - k)} ${n(cx + r)} ${n(cy)} c`,
        "h",
      ].join(" ");
      return paint(p.fill, p.s, ops, true);
    }
    case "path": {
      const ops = p.d
        .map((s) =>
          s[0] === "Z" ? "h" : s[0] === "C" ? `${n(s[1])} ${n(s[2])} ${n(s[3])} ${n(s[4])} ${n(s[5])} ${n(s[6])} c` : `${n(s[1])} ${n(s[2])} ${s[0] === "M" ? "m" : "l"}`
        )
        .join(" ");
      return paint(p.fill, p.s, ops, p.d.some((s) => s[0] === "Z"));
    }
    case "text":
      return `BT /${p.bold ? "F2" : "F1"} ${n(p.size)} Tf ${rgb(p.color ?? INK)} rg 1 0 0 -1 ${n(textLeft(p))} ${n(p.y)} Tm ${pdfString(p.text)} Tj ET`;
  }
}

export type Page = { w: number; h: number; items: Prim[] };

/** A PDF, one page per sheet. Page sizes are in sheet units. */
export function pdfDocument(pages: Page[], title: string): Uint8Array {
  const objs: string[] = [];
  const add = (body: string) => objs.push(body); // returns the 1-based object number
  const catalog = add("");
  const pagesObj = add("");
  const fonts = ["Helvetica", "Helvetica-Bold"].map((f) => add(`<< /Type /Font /Subtype /Type1 /BaseFont /${f} /Encoding /WinAnsiEncoding >>`));
  const fontRes = `<< /F1 ${fonts[0]} 0 R /F2 ${fonts[1]} 0 R >>`;
  const kids: number[] = [];
  for (const pg of pages) {
    // One CTM: scale to points and flip y, so primitives stay y-down.
    const content = [`q ${n(PT)} 0 0 ${n(-PT)} 0 ${n(pg.h * PT)} cm 1 J 1 j`, ...pg.items.map(primToPdf).filter(Boolean), "Q"].join("\n");
    const stream = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${n(pg.w * PT)} ${n(pg.h * PT)}] /Resources << /Font ${fontRes} >> /Contents ${stream} 0 R >>`));
  }
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objs[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;
  const info = add(`<< /Title ${pdfString(title)} /Producer (sepia) >>`);

  let out = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
  const offsets: number[] = [];
  objs.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return bytes;
}
