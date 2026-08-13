// Geometry for the skill medallion shapes (Journal → Skills grid). Each shape is defined
// once in a normalized 0-100 viewBox, independent of the actual pixel size the node renders
// at — pixel-space SVG points and percentage-based CSS clip-path strings are both derived
// from that single normalized vertex list, so they can never drift apart.

export type ShapeKey = "triangle" | "diamond_classic" | "diamond_ornate" | "medallion" | "insignia";

// Every skill now renders as a triangle by default (see SkillDiamond.tsx) — the other shapes
// are kept defined here in case a per-skill shape picker comes back later, but are currently
// unreachable from the UI.
export const SHAPE_KEYS: ShapeKey[] = ["triangle", "diamond_classic", "diamond_ornate", "medallion", "insignia"];

export const SHAPE_LABELS: Record<ShapeKey, string> = {
  triangle: "Triángulo",
  diamond_classic: "Rombo clásico",
  diamond_ornate: "Rombo ornamentado",
  medallion: "Medallón",
  insignia: "Insignia",
};

interface NormalizedVertexShape {
  kind: "polygon";
  vertices: { x: number; y: number }[]; // percent, 0-100
}

interface NormalizedCircleShape {
  kind: "circle";
  cx: number; cy: number; r: number; // percent, 0-100
}

type NormalizedShape = NormalizedVertexShape | NormalizedCircleShape;

export interface ShapeGeometry {
  kind: "polygon" | "circle";
  points?: string; // pixel-space "x,y x,y ..." for <polygon points>
  cx?: number; cy?: number; r?: number; // pixel-space, for <circle>
  clipPath: string; // percentage-based CSS clip-path (works at any container size)
}

function starVertices(cx: number, cy: number, outerR: number, innerR: number, spikes: number): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  const step = 180 / spikes; // degrees between an outer and its neighboring inner vertex
  for (let i = 0; i < spikes * 2; i++) {
    const radius = i % 2 === 0 ? outerR : innerR;
    const angleDeg = -90 + i * step;
    const angleRad = (angleDeg * Math.PI) / 180;
    points.push({ x: cx + radius * Math.cos(angleRad), y: cy + radius * Math.sin(angleRad) });
  }
  return points;
}

function getNormalizedShape(shape: ShapeKey): NormalizedShape {
  switch (shape) {
    case "triangle":
      // Wide-based badge triangle, point up — the new default look for every skill.
      return {
        kind: "polygon",
        vertices: [{ x: 50, y: 4 }, { x: 95, y: 93 }, { x: 5, y: 93 }],
      };
    case "diamond_ornate":
      // Faceted gem look: 4 primary diamond points + 4 inset notches between them.
      return { kind: "polygon", vertices: starVertices(50, 50, 46, 25, 4) };
    case "medallion":
      return { kind: "circle", cx: 50, cy: 50, r: 46 };
    case "insignia":
      // Heraldic shield: rounded shoulders tapering to a point at the bottom.
      return {
        kind: "polygon",
        vertices: [
          { x: 50, y: 4 }, { x: 90, y: 20 }, { x: 82, y: 60 },
          { x: 50, y: 96 }, { x: 18, y: 60 }, { x: 10, y: 20 },
        ],
      };
    case "diamond_classic":
    default:
      return {
        kind: "polygon",
        vertices: [{ x: 50, y: 4 }, { x: 96, y: 50 }, { x: 50, y: 96 }, { x: 4, y: 50 }],
      };
  }
}

/** Same shape, scaled about its own center (50,50) — used to draw slightly bigger/smaller
 *  copies of the outline for depth (shadow), bevel highlight, and rarity rings. */
export function getShapeGeometryAtScale(shape: ShapeKey, size: number, scale: number): ShapeGeometry {
  const norm = getNormalizedShape(shape);
  if (norm.kind === "circle") {
    const r = norm.r * scale;
    return {
      kind: "circle",
      cx: (norm.cx / 100) * size,
      cy: (norm.cy / 100) * size,
      r: (r / 100) * size,
      clipPath: `circle(${r}% at ${norm.cx}% ${norm.cy}%)`,
    };
  }
  const scaled = norm.vertices.map((p) => ({ x: 50 + (p.x - 50) * scale, y: 50 + (p.y - 50) * scale }));
  return {
    kind: "polygon",
    points: scaled.map((p) => `${((p.x / 100) * size).toFixed(2)},${((p.y / 100) * size).toFixed(2)}`).join(" "),
    clipPath: `polygon(${scaled.map((p) => `${p.x}% ${p.y}%`).join(", ")})`,
  };
}

export function getShapeGeometry(shape: ShapeKey, size: number): ShapeGeometry {
  return getShapeGeometryAtScale(shape, size, 1);
}

/** Outer vertex positions in pixel space, used to place rarity "rivet" flourishes
 *  (epic/legendary) at the shape's points. For the circle shape these are 8 evenly
 *  spaced points around the ring rather than true corners. */
export function getOuterVertices(shape: ShapeKey, size: number): { x: number; y: number }[] {
  const norm = getNormalizedShape(shape);
  if (norm.kind === "circle") {
    return starVertices(norm.cx, norm.cy, norm.r, norm.r, 4).map((p) => ({
      x: (p.x / 100) * size,
      y: (p.y / 100) * size,
    }));
  }
  return norm.vertices.map((p) => ({ x: (p.x / 100) * size, y: (p.y / 100) * size }));
}
