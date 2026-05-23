import { create } from "zustand";
import type { AppState, BrushType } from "../types";
import { HEIGHTMAP_SIZE, MAX_UNDO } from "../types";

function createEmptyHeightmap(): Float32Array {
  const size = HEIGHTMAP_SIZE * HEIGHTMAP_SIZE;
  const data = new Float32Array(size);
  const seaLevel = 0.15;
  for (let i = 0; i < size; i++) {
    data[i] = seaLevel + 0.05;
  }
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

function gaussianBlur(
  hm: Float32Array,
  cx: number,
  cy: number,
  radius: number
): number {
  let sum = 0;
  let weightSum = 0;
  const sigma = radius / 3;
  const r = Math.ceil(radius);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (inBounds(nx, ny)) {
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d <= radius) {
          const w = Math.exp(-(d * d) / (2 * sigma * sigma));
          sum += hm[getIndex(nx, ny)] * w;
          weightSum += w;
        }
      }
    }
  }
  return weightSum > 0 ? sum / weightSum : hm[getIndex(cx, cy)];
}

function applyBrushOp(
  hm: Float32Array,
  cx: number,
  cy: number,
  radius: number,
  strength: number,
  type: BrushType
): void {
  const sigma = radius / 3;
  const points = gaussianKernel(cx, cy, radius);

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
        const avg = avgInRadius(hm, px, py, radius);
        hm[idx] = hm[idx] + (avg - hm[idx]) * strength * w;
        break;
      }
      case "smooth": {
        const blurred = gaussianBlur(hm, px, py, radius);
        hm[idx] = hm[idx] + (blurred - hm[idx]) * strength * w;
        break;
      }
    }
  }
}

export const useHeightmapStore = create<AppState>((set, get) => ({
  mode: "edit",
  viewMode: "3d",
  heightmap: null,
  brush: { radius: 20, strength: 0.117, type: "camera" },
  simProgress: null,
  archive: null,
  undoStack: [],
  redoStack: [],
  markers: [],
  mouseHeight: 0,
  mouseBiome: "Ocean",

  initHeightmap: (data: Float32Array) => {
    set({ heightmap: data, mode: "edit", undoStack: [], redoStack: [] });
  },

  applyBrush: (x: number, y: number) => {
    const { heightmap, brush, undoStack } = get();
    if (!heightmap) return;
    const copy = new Float32Array(heightmap);
    applyBrushOp(copy, x, y, brush.radius, brush.strength, brush.type);
    const newUndo = [...undoStack, new Float32Array(heightmap)].slice(-MAX_UNDO);
    set({ heightmap: copy, undoStack: newUndo, redoStack: [] });
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
  setMouseInfo: (height, biome) => set({ mouseHeight: height, mouseBiome: biome }),

  addMarker: (x, y) => {
    set((s) => ({ markers: [...s.markers, { x, y }] }));
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
      mouseHeight: 0,
      mouseBiome: "Ocean",
    });
  },
}));
