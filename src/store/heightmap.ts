import { create } from "zustand";
import type { AppState, BrushType } from "../types";
import { HEIGHTMAP_SIZE, MAX_UNDO } from "../types";

function createEmptyHeightmap(): Float32Array {
  const size = HEIGHTMAP_SIZE * HEIGHTMAP_SIZE;
  const data = new Float32Array(size);
  data.fill(0.08); // flat shallow ocean
  return data;
}

function gaussianKernel(
  cx: number,
  cy: number,
  radius: number
): [number, number][] {
  const points: [number, number][] = [];
  const r = Math.ceil(radius);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= radius) {
        points.push([cx + dx, cy + dy]);
      }
    }
  }
  return points;
}

function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < HEIGHTMAP_SIZE && y >= 0 && y < HEIGHTMAP_SIZE;
}

function getIndex(x: number, y: number): number {
  return y * HEIGHTMAP_SIZE + x;
}

function avgInRadius(
  hm: Float32Array,
  cx: number,
  cy: number,
  radius: number
): number {
  let sum = 0;
  let count = 0;
  const r = Math.ceil(radius);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (inBounds(nx, ny)) {
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d <= radius) {
          sum += hm[getIndex(nx, ny)];
          count++;
        }
      }
    }
  }
  return count > 0 ? sum / count : hm[getIndex(cx, cy)];
}

function blurredRegion(
  hm: Float32Array,
  cx: number,
  cy: number,
  radius: number
): Float32Array {
  const r = Math.ceil(radius);
  const size = r * 2 + 1;
  const winR = Math.max(1, Math.ceil(radius / 2));
  const winW = winR * 2 + 1;

  // Extract region values into a dense buffer (out-of-bounds = NaN sentinel)
  const src = new Float32Array(size * size);
  src.fill(NaN);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const px = cx + dx, py = cy + dy;
      if (inBounds(px, py)) src[(dy + r) * size + (dx + r)] = hm[getIndex(px, py)];
    }
  }

  // Separable box blur: horizontal → vertical, each O(r²) with sliding window
  const hBlur = new Float32Array(size * size);
  for (let row = 0; row < size; row++) {
    let sum = 0, count = 0;
    // Initialize window at leftmost position
    for (let wx = 0; wx < winW && wx < size; wx++) {
      const v = src[row * size + wx];
      if (!isNaN(v)) { sum += v; count++; }
    }
    hBlur[row * size + 0] = count > 0 ? sum / count : NaN;
    // Slide window right
    for (let col = 1; col < size; col++) {
      const leave = col - 1;
      const enter = col + winW - 1;
      if (enter < size) {
        const ve = src[row * size + enter];
        if (!isNaN(ve)) { sum += ve; count++; }
      }
      if (leave < size) {
        const vl = src[row * size + leave];
        if (!isNaN(vl)) { sum -= vl; count--; }
      }
      hBlur[row * size + col] = count > 0 ? sum / count : NaN;
    }
  }

  // Vertical pass: sliding window over columns of hBlur
  const result = new Float32Array(size * size);
  for (let col = 0; col < size; col++) {
    let sum = 0, count = 0;
    for (let wy = 0; wy < winW && wy < size; wy++) {
      const v = hBlur[wy * size + col];
      if (!isNaN(v)) { sum += v; count++; }
    }
    result[0 * size + col] = count > 0 ? sum / count : NaN;
    for (let row = 1; row < size; row++) {
      const leave = row - 1;
      const enter = row + winW - 1;
      if (enter < size) {
        const ve = hBlur[enter * size + col];
        if (!isNaN(ve)) { sum += ve; count++; }
      }
      if (leave < size) {
        const vl = hBlur[leave * size + col];
        if (!isNaN(vl)) { sum -= vl; count--; }
      }
      result[row * size + col] = count > 0 ? sum / count : NaN;
    }
  }

  return result;
}

export function applyBrushOp(
  hm: Float32Array,
  cx: number,
  cy: number,
  radius: number,
  strength: number,
  type: BrushType
): void {
  const sigma = radius / 3;
  const points = gaussianKernel(cx, cy, radius);

  // Pre-compute blurred region for smooth/flatten to avoid O(n²)
  let blurred: Float32Array | null = null;
  let blurSize = 0;
  const needsBlur = type === "smooth" || type === "flatten";
  if (needsBlur) {
    blurred = blurredRegion(hm, cx, cy, radius);
    blurSize = Math.ceil(radius) * 2 + 1;
  }

  for (const [px, py] of points) {
    if (!inBounds(px, py)) continue;
    const d = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
    const w = Math.exp(-(d * d) / (2 * sigma * sigma));
    const idx = getIndex(px, py);

    switch (type) {
      case "raise":
        hm[idx] = Math.min(1, hm[idx] + strength * w);
        break;
      case "lower":
        hm[idx] = Math.max(0, hm[idx] - strength * w);
        break;
      case "flatten": {
        const bi = (py - cy + Math.ceil(radius)) * blurSize + (px - cx + Math.ceil(radius));
        const avg = blurred![bi] ?? avgInRadius(hm, px, py, radius);
        hm[idx] = hm[idx] + (avg - hm[idx]) * strength * w;
        break;
      }
      case "smooth": {
        const bi = (py - cy + Math.ceil(radius)) * blurSize + (px - cx + Math.ceil(radius));
        const avg = blurred![bi] ?? avgInRadius(hm, px, py, radius);
        const blend = Math.min(1, strength * 8 * w);
        hm[idx] = hm[idx] + (avg - hm[idx]) * blend;
        break;
      }
      case "water": {
        const target = 0.12;
        hm[idx] = hm[idx] + (target - hm[idx]) * strength * w;
        break;
      }
      case "glacier": {
        // Aperiodic hash-based noise at brush scale
        const s = Math.max(radius * 0.35, 4);
        function h(x: number, y: number): number {
          let v = x * 127.1 + y * 311.7;
          v = Math.sin(v) * 43758.5453;
          return v - Math.floor(v);
        }
        const fx = px / s, fy = py / s;
        const ix = Math.floor(fx), iy = Math.floor(fy);
        const rx = fx - ix, ry = fy - iy;
        const sx = rx * rx * (3 - 2 * rx); // smoothstep
        const sy = ry * ry * (3 - 2 * ry);
        const n = (h(ix, iy) * (1 - sx) * (1 - sy) +
                   h(ix + 1, iy) * sx * (1 - sy) +
                   h(ix, iy + 1) * (1 - sx) * sy +
                   h(ix + 1, iy + 1) * sx * sy);
        const carve = w * Math.max(0, n - 0.35) * 1.5;
        hm[idx] = Math.max(0, hm[idx] - strength * 2 * carve);
        break;
      }
    }
  }
}

export const useHeightmapStore = create<AppState>((set, get) => ({
  mode: "edit",
  viewMode: "3d",
  heightmap: null,
  brush: { radius: 25, strength: 0.025, type: "raise" },
  simProgress: null,
  archive: null,
  undoStack: [],
  redoStack: [],
  markers: [],
  customPins: [],
  customRegions: [],
  activeTool: "brush",
  mouseHeight: 0,
  mouseBiome: "海洋",
  mouseLat: 0,
  mouseLon: 0,
  multiTouchActive: false,
  webglLost: false,
  terrainFresh: true,
  riverData: { riverMask: null, lakeMask: null, flowAccum: null, precipMap: null, tempMap: null, riverPaths: null, lakeRegions: null },

  initHeightmap: (data: Float32Array) => {
    set({ heightmap: data, mode: "edit", undoStack: [], redoStack: [], terrainFresh: true });
  },

  applyBrush: (x: number, y: number) => {
    const { heightmap, brush, undoStack } = get();
    if (!heightmap) return;
    const copy = new Float32Array(heightmap);
    applyBrushOp(copy, x, y, brush.radius, brush.strength, brush.type);
    const newUndo = [...undoStack, new Float32Array(heightmap)].slice(-MAX_UNDO);
    set({ heightmap: copy, undoStack: newUndo, redoStack: [], terrainFresh: false });
  },

  undo: () => {
    const { heightmap, undoStack, redoStack } = get();
    if (undoStack.length === 0 || !heightmap) return;
    const prev = undoStack[undoStack.length - 1];
    set({
      heightmap: prev,
      undoStack: undoStack.slice(0, -1),
      redoStack: [new Float32Array(heightmap), ...redoStack],
    });
  },

  redo: () => {
    const { heightmap, redoStack, undoStack } = get();
    if (redoStack.length === 0 || !heightmap) return;
    const next = redoStack[0];
    set({
      heightmap: next,
      redoStack: redoStack.slice(1),
      undoStack: [...undoStack, new Float32Array(heightmap)],
    });
  },

  setBrush: (partial: Partial<AppState["brush"]>) => {
    set((s) => ({ brush: { ...s.brush, ...partial } }));
  },

  setMode: (mode: AppState["mode"]) => set({ mode }),
  setViewMode: (vm) => set({ viewMode: vm }),
  setSimProgress: (progress) => set({ simProgress: progress }),
  setArchive: (archive) => set({ archive }),
  setMouseInfo: (height, biome, lat, lon) => set({ mouseHeight: height, mouseBiome: biome, mouseLat: lat, mouseLon: lon }),

  setMultiTouchActive: (active) => set({ multiTouchActive: active }),
  setWebglLost: (lost) => set({ webglLost: lost }),
  setTerrainFresh: (fresh) => set({ terrainFresh: fresh }),

  addMarker: (x, y) => {
    set((s) => ({ markers: [...s.markers, { x, y }] }));
  },

  setPinAnalyses: (analyses) => {
    set((s) => ({
      markers: s.markers.map((m, i) => ({
        ...m,
        analysis: analyses[i] || m.analysis,
      })),
    }));
  },

  setActiveTool: (tool) => set({ activeTool: tool }),

  addCustomPin: (x, y, content) => {
    set((s) => ({
      customPins: [...s.customPins, { id: Date.now().toString(36), x, y, content }],
    }));
  },

  addCustomRegion: (points, name) => {
    set((s) => ({
      customRegions: [...s.customRegions, { id: Date.now().toString(36), name, points }],
    }));
  },

  setRiverData: (data) => {
    set((s) => ({ riverData: { ...s.riverData, ...data } }));
  },

  reset: () => {
    set({
      mode: "edit",
      viewMode: "3d",
      heightmap: createEmptyHeightmap(),
      undoStack: [],
      redoStack: [],
      simProgress: null,
      archive: null,
      markers: [],
      customPins: [],
      customRegions: [],
      mouseHeight: 0,
      mouseBiome: "海洋",
      multiTouchActive: false,
      terrainFresh: true,
      riverData: { riverMask: null, lakeMask: null, flowAccum: null, precipMap: null, tempMap: null, riverPaths: null, lakeRegions: null },
    });
  },
}));
