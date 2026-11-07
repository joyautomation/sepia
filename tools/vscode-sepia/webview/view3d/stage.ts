// The three.js side of the 3D view: boxes from core/scene3d.ts, a door
// that swings on its hinge, tags on the parts' faces, hover picking and
// a few fixed camera views. It draws only when something changes.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Box3, Scene3D } from "../../src/core/scene3d.ts";

export type ViewName = "iso" | "front" | "right" | "top";
export type Toggles = { walls: boolean; clearances: boolean; tags: boolean };

const COLOR = {
  wall: 0xc9ced3,
  wallEdge: 0x7d848b,
  backpanel: 0xf1f0eb,
  rail: 0xb9bdc2,
  duct: 0x9aa0a6,
  part: 0x56677a,
  door: 0x2c2f33,
  outside: 0xb4b9bf,
  error: 0xd64545,
  warning: 0xd99a26,
  background: 0x2a2e33,
  clearance: 0x3b82f6,
  hover: 0x0a6cff,
  edge: 0x1c2026,
};
const OPEN = (110 * Math.PI) / 180;

type Entry = { box: Box3; mesh: THREE.Mesh; color: number };

export class Stage {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(35, 1, 5, 50000);
  private readonly controls: OrbitControls;
  private readonly root = new THREE.Group();
  private readonly door = new THREE.Group();
  private readonly ray = new THREE.Raycaster();
  private entries: Entry[] = [];
  private picks: THREE.Mesh[] = [];
  private walls: THREE.Object3D[] = [];
  private clearances: THREE.Object3D[] = [];
  private tags: THREE.Object3D[] = [];
  private S: Scene3D | undefined;
  private hovered: Entry | undefined;
  private frame = 0;
  private doorAngle = 0;
  private doorTarget = 0;
  toggles: Toggles = { walls: true, clearances: true, tags: true };

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onHover: (b: Box3 | undefined, x: number, y: number) => void,
    private readonly onPick: (b: Box3 | undefined) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.setClearColor(COLOR.background);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x50555c, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(0.6, 1, 1.4);
    this.scene.add(sun);
    this.scene.add(this.root);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.addEventListener("change", () => this.draw());
    canvas.addEventListener("pointermove", (e) => this.hover(e));
    canvas.addEventListener("pointerleave", () => this.setHover(undefined, 0, 0));
    let down: { x: number; y: number } | undefined;
    canvas.addEventListener("pointerdown", (e) => (down = { x: e.clientX, y: e.clientY }));
    canvas.addEventListener("pointerup", (e) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 4) this.onPick(this.pickAt(e.clientX, e.clientY)?.box);
      down = undefined;
    });
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement!);
    this.resize();
  }

  /** Mm, y down, z out → three's y up. */
  private place(o: THREE.Object3D, b: Box3) {
    o.position.set(b.x + b.w / 2, -(b.y + b.h / 2), b.z + b.d / 2);
  }

  /** `bad`: tags with a problem on this sheet, and the worst of them. */
  setScene(S: Scene3D, bad: Map<string, "error" | "warning">): void {
    const first = !this.S;
    this.S = S;
    this.root.clear();
    this.door.clear();
    this.entries = [];
    this.picks = [];
    this.walls = [];
    this.clearances = [];
    this.tags = [];
    const E = S.enclosure;
    // The door turns about its hinge edge, at the enclosure's front.
    const hingeX = E.hinge === "left" ? 0 : E.w;
    this.door.position.set(hingeX, 0, E.d);
    this.root.add(this.door);

    for (const b of S.boxes) {
      const geo = new THREE.BoxGeometry(Math.max(b.w, 0.5), Math.max(b.h, 0.5), Math.max(b.d, 0.5));
      const color = b.kind === "part" ? (b.tag && bad.has(b.tag) ? COLOR[bad.get(b.tag)!] : b.on === "door" ? COLOR.door : b.on === "outside" ? COLOR.outside : COLOR.part) : b.kind === "backpanel" ? COLOR.backpanel : b.kind === "rail" ? COLOR.rail : b.kind === "duct" ? COLOR.duct : b.kind === "clearance" ? COLOR.clearance : COLOR.wall;
      const glass = b.kind === "enclosure" ? (b.id === "wall:door" ? 0.16 : 0.1) : b.kind === "clearance" ? 0.1 : b.unsized ? 0.5 : 1;
      const mat = new THREE.MeshStandardMaterial({ color, roughness: b.kind === "rail" ? 0.35 : 0.8, metalness: b.kind === "rail" || b.on === "outside" ? 0.4 : 0, transparent: glass < 1, opacity: glass, depthWrite: glass === 1 });
      const mesh = new THREE.Mesh(geo, mat);
      this.place(mesh, b);
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: b.kind === "enclosure" ? COLOR.wallEdge : b.kind === "clearance" ? COLOR.clearance : COLOR.edge, transparent: true, opacity: b.kind === "clearance" ? 0.5 : b.kind === "enclosure" ? 0.6 : 0.35 }),
      );
      mesh.add(edges);
      const parent = b.on === "door" ? this.door : this.root;
      if (b.on === "door") mesh.position.sub(this.door.position);
      parent.add(mesh);
      const entry = { box: b, mesh, color };
      this.entries.push(entry);
      if (b.kind === "part" || b.kind === "rail" || b.kind === "duct") this.picks.push(mesh);
      if (b.kind === "enclosure") this.walls.push(mesh);
      if (b.kind === "clearance") this.clearances.push(mesh);
      if (b.kind === "part") {
        const t = tagPlane(b, E.d);
        if (t) {
          if (b.on === "door") t.position.sub(this.door.position);
          parent.add(t);
          this.tags.push(t);
        }
      }
    }
    this.hovered = undefined;
    this.apply();
    if (first) this.view("iso");
    else this.draw();
  }

  /** Show or hide walls, clearances and tags. */
  apply(): void {
    for (const o of this.walls) o.visible = this.toggles.walls;
    for (const o of this.clearances) o.visible = this.toggles.clearances;
    for (const o of this.tags) o.visible = this.toggles.tags;
    this.draw();
  }

  get doorOpen(): boolean {
    return this.doorTarget > 0;
  }

  setDoor(open: boolean, animate = true): void {
    this.doorTarget = open ? 1 : 0;
    if (!animate) {
      this.doorAngle = this.doorTarget;
      this.turnDoor();
      return;
    }
    const start = performance.now();
    const from = this.doorAngle;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 350);
      this.doorAngle = from + (this.doorTarget - from) * (1 - (1 - t) ** 3);
      this.turnDoor();
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  private turnDoor() {
    const sign = this.S?.enclosure.hinge === "right" ? 1 : -1;
    this.door.rotation.y = sign * OPEN * this.doorAngle;
    this.draw();
  }

  /** A fixed view, fitted to everything: the camera backs off until every
   * corner of the scene's bounds is inside the frame. */
  view(name: ViewName): void {
    if (!this.S) return;
    const box = new THREE.Box3().setFromObject(this.root);
    const centre = box.getCenter(new THREE.Vector3());
    const dir = { iso: new THREE.Vector3(0.55, 0.35, 1), front: new THREE.Vector3(0, 0, 1), right: new THREE.Vector3(1, 0, 0), top: new THREE.Vector3(0, 1, 0.001) }[name].normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(up, dir).normalize();
    const camUp = new THREE.Vector3().crossVectors(dir, right).normalize();
    const tanV = Math.tan(((this.camera.fov / 2) * Math.PI) / 180);
    const tanH = tanV * this.camera.aspect;
    let dist = 0;
    for (const x of [box.min.x, box.max.x])
      for (const y of [box.min.y, box.max.y])
        for (const z of [box.min.z, box.max.z]) {
          const v = new THREE.Vector3(x, y, z).sub(centre);
          const toward = v.dot(dir);
          dist = Math.max(dist, toward + Math.abs(v.dot(right)) / tanH, toward + Math.abs(v.dot(camUp)) / tanV);
        }
    this.camera.position.copy(centre).addScaledVector(dir, dist * 1.06);
    this.camera.up.copy(up);
    this.controls.target.copy(centre);
    this.camera.lookAt(centre);
    this.controls.update();
    this.draw();
  }

  /** A box's front-face centre, in viewport pixels (for the harness). */
  screenOf(id: string): { x: number; y: number } | null {
    const e = this.entries.find((x) => x.box.id === id);
    if (!e) return null;
    const b = e.box;
    const p = new THREE.Vector3(b.x + b.w / 2, -(b.y + b.h / 2), b.z + b.d);
    if (b.on === "door") {
      p.sub(this.door.position).applyEuler(this.door.rotation).add(this.door.position);
    }
    p.project(this.camera);
    const r = this.canvas.getBoundingClientRect();
    return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
  }

  private pickAt(cx: number, cy: number): Entry | undefined {
    const r = this.canvas.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), this.camera);
    const hit = this.ray.intersectObjects(this.picks, false)[0];
    return hit ? this.entries.find((e) => e.mesh === hit.object) : undefined;
  }

  private hover(e: PointerEvent) {
    if (e.buttons) return;
    this.setHover(this.pickAt(e.clientX, e.clientY), e.clientX, e.clientY);
  }

  private setHover(h: Entry | undefined, x: number, y: number) {
    if (h !== this.hovered) {
      if (this.hovered) (this.hovered.mesh.material as THREE.MeshStandardMaterial).emissive.setHex(0);
      this.hovered = h;
      if (h) (h.mesh.material as THREE.MeshStandardMaterial).emissive.setHex(0x0a3a8a);
      this.draw();
    }
    this.onHover(h?.box, x, y);
  }

  /** Light up one part (the one picked in the list). */
  highlight(tag: string | undefined): void {
    for (const e of this.entries) {
      if (e.box.kind !== "part") continue;
      (e.mesh.material as THREE.MeshStandardMaterial).color.setHex(e.box.tag === tag ? COLOR.hover : e.color);
    }
    this.draw();
  }

  private resize() {
    const host = this.canvas.parentElement!;
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.draw();
  }

  draw(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.renderer.render(this.scene, this.camera);
    });
  }

  dispose(): void {
    this.controls.dispose();
    this.renderer.dispose();
  }
}

/** A part's tag on its front face (a door part's on the door's outside,
 * where its legend plate is), sized to fit the face. Too small: none. */
function tagPlane(b: Box3, encD: number): THREE.Mesh | undefined {
  const text = b.tag!;
  const PX = 64; // canvas px per text height
  const c = document.createElement("canvas");
  const g = c.getContext("2d")!;
  g.font = `600 ${PX}px Helvetica, Arial, sans-serif`;
  const tw = g.measureText(text).width / PX; // width per unit height
  // Text height in mm: up to 14, to fit across the face, else along it.
  const across = Math.min(14, (b.w * 0.86) / tw, b.h * 0.5);
  const along = Math.min(14, (b.h * 0.86) / tw, b.w * 0.6);
  const vertical = across < 3.5 && along > across;
  const th = vertical ? along : across;
  if (th < 3.5) return undefined;
  c.width = Math.ceil(tw * PX) + 16;
  c.height = PX + 16;
  g.font = `600 ${PX}px Helvetica, Arial, sans-serif`;
  if (b.on === "door") {
    // A legend plate.
    g.fillStyle = "#f4f4f0";
    g.fillRect(0, 0, c.width, c.height);
  }
  g.fillStyle = b.on === "inside" ? "#ffffff" : "#16181b";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, c.width / 2, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry((th * c.width) / PX, (th * c.height) / PX),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  const z = b.on === "door" ? encD + 0.6 : b.z + b.d + 0.6;
  plane.position.set(b.x + b.w / 2, -(b.y + b.h / 2), z);
  if (vertical) plane.rotation.z = Math.PI / 2;
  return plane;
}
