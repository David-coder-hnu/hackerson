export type BrushType = "raise" | "lower" | "flatten" | "smooth";
export type AppMode = "edit" | "simulating" | "observing";

export interface BrushState {
  radius: number;
  strength: number;
  type: BrushType;
}

export interface SimProgress {
  phase: "hydrology" | "climate";
  riverMask?: Uint8Array;
  lakeMask?: Uint8Array;
  flowAccum?: Float32Array;
  precipMap?: Float32Array;
  tempMap?: Float32Array;
}

export interface PlanetArchive {
  terrain: {
    mountainPct: number;
    basinPct: number;
    plainPct: number;
    plateauPct: number;
  };
  climate: {
    zones: Array<{ name: string; pct: number }>;
    prevailingWind: string;
  };
  hydrology: {
    riverCount: number;
    lakeCount: number;
    watershedArea: number;
  };
}

export interface SimRequest {
  type: "SIMULATE";
  heightmap: Float32Array;
  windDirection: number;
  seaLevel: number;
}

export interface AppState {
  mode: AppMode;
  heightmap: Float32Array | null;
  brush: BrushState;
  simProgress: SimProgress | null;
  archive: PlanetArchive | null;
  undoStack: Float32Array[];
  redoStack: Float32Array[];

  setMode: (mode: AppMode) => void;
  initHeightmap: (data: Float32Array) => void;
  applyBrush: (x: number, y: number) => void;
  undo: () => void;
  redo: () => void;
  setBrush: (brush: Partial<BrushState>) => void;
  setSimProgress: (progress: SimProgress | null) => void;
  setArchive: (archive: PlanetArchive | null) => void;
  reset: () => void;
}

export const HEIGHTMAP_SIZE = 512;
export const MAX_UNDO = 20;
