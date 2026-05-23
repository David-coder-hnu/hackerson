export type BrushType = "camera" | "raise" | "lower" | "flatten" | "smooth" | "water" | "marker";
export type AppMode = "edit" | "simulating" | "observing";
export type ViewMode = "3d" | "2d";
export type ToolType = BrushType | "random" | "rivers" | "diagnosis" | "toggle" | "reset";

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
    koppen: { code: string; name: string; nameEn: string; mainClass: string; description: string };
    holdridge: { biome: string; biomeZh: string; latBelt: string; humidity: string; bt: number; per: number };
    avgTemp: number;
    avgPrecip: number;
    annualRange: number;
    prevailingWind: string;
  };
  hydrology: {
    riverCount: number;
    lakeCount: number;
    watershedArea: number;
  };
  soils: Array<{ name: string; wrb: string; frequency: string; note: string; confidence: string }>;
  plants: Array<{ habitat: string; description: string; species: Array<{ name: string; uses: string; rarity: string }> }>;
  landArea: number;
}

export interface SimRequest {
  type: "SIMULATE";
  heightmap: Float32Array;
  windDirection: number;
  seaLevel: number;
}

export interface RiverData {
  riverMask: Uint8Array | null;
  lakeMask: Uint8Array | null;
  flowAccum: Float32Array | null;
  precipMap: Float32Array | null;
  tempMap: Float32Array | null;
  riverPaths: number[][][] | null;  // array of paths, each path is array of [x,y]
  lakeRegions: number[][][] | null; // array of regions, each is array of [x,y] cells
}

export interface AppState {
  mode: AppMode;
  viewMode: ViewMode;
  heightmap: Float32Array | null;
  brush: BrushState;
  simProgress: SimProgress | null;
  archive: PlanetArchive | null;
  undoStack: Float32Array[];
  redoStack: Float32Array[];
  markers: Array<{ x: number; y: number }>;
  mouseHeight: number;
  mouseBiome: string;
  mouseLat: number;
  mouseLon: number;
  riverData: RiverData;

  setMode: (mode: AppMode) => void;
  setViewMode: (vm: ViewMode) => void;
  initHeightmap: (data: Float32Array) => void;
  applyBrush: (x: number, y: number) => void;
  undo: () => void;
  redo: () => void;
  setBrush: (brush: Partial<BrushState>) => void;
  setSimProgress: (progress: SimProgress | null) => void;
  setArchive: (archive: PlanetArchive | null) => void;
  setMouseInfo: (height: number, biome: string, lat: number, lon: number) => void;
  addMarker: (x: number, y: number) => void;
  setRiverData: (data: Partial<RiverData>) => void;
  reset: () => void;
}

export const HEIGHTMAP_SIZE = 512;
export const MAX_UNDO = 20;
