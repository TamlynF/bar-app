import { clamp } from "./geometry";

export type LabelBounds = { minX: number; minY: number; maxX: number; maxY: number };

export type LabelInput = {
  key: string;
  text: string;
  bounds: LabelBounds; // the shape's on-screen extent, rotation already applied
  width: number; // the shape's own unrotated size
  length: number;
  rotation: number;
  outsideOnly: boolean; // polygons (whose centre may sit outside the shape) and shapes whose middle is already occupied
  ink: string;
};

export type PlacedLabel = {
  key: string;
  text: string;
  cx: number; // shape centre - where the leader line points back to
  cy: number;
  x: number; // label centre
  y: number;
  w: number;
  h: number;
  inside: boolean;
  ink: string;
};

export type LabelLayoutOptions = { fontSize: number; viewWidth: number };

type Box = { x: number; y: number; w: number; h: number };

const CHAR_RATIO = 0.58; // rough advance width of Archivo bold per character
const CLEARANCE = 1.1; // keep a tenth of the text box spare before calling it a fit

export function labelTextWidth(text: string, fontSize: number): number {
  return Math.max(fontSize * 1.5, text.length * fontSize * CHAR_RATIO + fontSize * 0.7);
}

// A horizontal text box of tw x th sits inside a width x length rectangle spun by
// `rotation` when its half-extents, projected onto the shape's own axes, stay within it.
export function labelFitsInside(
  width: number,
  length: number,
  rotation: number,
  tw: number,
  th: number
): boolean {
  const rad = (rotation * Math.PI) / 180;
  const c = Math.abs(Math.cos(rad));
  const s = Math.abs(Math.sin(rad));
  const hw = (tw * CLEARANCE) / 2;
  const hh = (th * CLEARANCE) / 2;
  return hw * c + hh * s <= width / 2 && hw * s + hh * c <= length / 2;
}

function boxAt(label: PlacedLabel, y: number): Box {
  return { x: label.x - label.w / 2, y: y - label.h / 2, w: label.w, h: label.h };
}

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function layoutLabels(items: LabelInput[], opts: LabelLayoutOptions): PlacedLabel[] {
  const { fontSize, viewWidth } = opts;
  const h = fontSize * 1.2;
  const gap = fontSize * 0.55;
  const step = h * 1.12;

  const slots = new Map<string, { above: number; below: number }>();
  const placed: PlacedLabel[] = items.map((item) => {
    const w = labelTextWidth(item.text, fontSize);
    const cx = (item.bounds.minX + item.bounds.maxX) / 2;
    const cy = (item.bounds.minY + item.bounds.maxY) / 2;
    const inside = !item.outsideOnly && labelFitsInside(item.width, item.length, item.rotation, w, h);
    const above = item.bounds.minY - gap - h / 2;
    slots.set(item.key, { above, below: item.bounds.maxY + gap + h / 2 });
    return {
      key: item.key,
      text: item.text,
      cx,
      cy,
      x: clamp(cx, w / 2, Math.max(w / 2, viewWidth - w / 2)),
      y: inside ? cy : above,
      w,
      h,
      inside,
      ink: item.ink,
    };
  });

  const taken: Box[] = placed.filter((l) => l.inside).map((l) => boxAt(l, l.y));
  const outside = placed.filter((l) => !l.inside).sort((a, b) => a.y - b.y);

  for (const label of outside) {
    const slot = slots.get(label.key)!;
    let y = slot.above;
    let guard = 0;
    while (guard++ < 40 && taken.some((t) => overlaps(boxAt(label, y), t))) y -= step;
    if (y - label.h / 2 < 0) {
      y = slot.below;
      guard = 0;
      while (guard++ < 40 && taken.some((t) => overlaps(boxAt(label, y), t))) y += step;
    }
    label.y = y;
    taken.push(boxAt(label, y));
  }

  return placed;
}
