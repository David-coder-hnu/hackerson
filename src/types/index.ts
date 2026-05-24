export type BrushType = "camera" | "raise" | "lower" | "flatten" | "smooth" | "water" | "marker" | "glacier";
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
  pinAnalyses?: PinAnalysis[];
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

export interface PinAnalysis {
  lat: number;
  lon: number;
  elevation: number;
  slope: number;
  aspect: string;
  coastDist: number;
  pressureBelt: string;
  koppen: string;
  holdridge: string;
  soil: string;
  plants: string[];
  crops: string[];
  tempAnnual: number;
  precipAnnual: number;
  description: string;
  animals?: Array<{ name: string; size: string; diet: string; habitat: string; special: string }>;
  minerals?: string[];
  cityPotential?: { score: number; strengths: string[]; suitable: string[] };
}

export interface Marker {
  x: number;
  y: number;
  analysis?: PinAnalysis;
}

export interface CustomPin {
  id: string;
  x: number;
  y: number;
  content: string;
}

export interface CustomRegion {
  id: string;
  name: string;
  points: Array<{ x: number; y: number }>; // polygon vertices in grid coords
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
  markers: Marker[];
  customPins: CustomPin[];
  customRegions: CustomRegion[];
  activeTool: "brush" | "pin" | "region";
  mouseHeight: number;
  mouseBiome: string;
  mouseLat: number;
  mouseLon: number;
  multiTouchActive: boolean;
  webglLost: boolean;
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
  setPinAnalyses: (analyses: PinAnalysis[]) => void;
  setActiveTool: (tool: "brush" | "pin" | "region") => void;
  addCustomPin: (x: number, y: number, content: string) => void;
  addCustomRegion: (points: Array<{x:number;y:number}>, name: string) => void;
  setMultiTouchActive: (active: boolean) => void;
  setWebglLost: (lost: boolean) => void;
  setRiverData: (data: Partial<RiverData>) => void;
  reset: () => void;
}

export const HEIGHTMAP_SIZE = 512;
export const MAX_UNDO = 20;
