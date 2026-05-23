// Planetary coordinate system for the terrain grid
// The grid represents the entire planet: 360° longitude × 180° latitude

export const SIZE = 512;
const RAD = Math.PI / 180;

export interface CellGeo {
  lat: number;    // degrees, -90 (south pole) to 90 (north pole)
  lon: number;    // degrees, -180 (west) to 180 (east)
  elev: number;   // 0-1 normalized, 1.0 = ~10km (Everest scale)
  slope: number;  // 0-1 normalized steepness
  aspect: number; // radians, 0 = north-facing, PI = south-facing (NH)
}

// Grid position → latitude/longitude
// y=0 = 90°N (north pole), y=SIZE-1 = -90°S (south pole)
// x=0 = -180°W, x=SIZE-1 = 180°E
export function cellLat(y: number): number {
  return 90 - (y / (SIZE - 1)) * 180;
}

export function cellLon(x: number): number {
  return (x / (SIZE - 1)) * 360 - 180;
}

// Get full geo for a cell
export function getCellGeo(
  x: number, y: number, hm: Float32Array
): CellGeo {
  const idx = y * SIZE + x;
  const lat = cellLat(y);
  const lon = cellLon(x);
  const elev = hm[idx];

  // Slope: max height difference with 8 neighbors
  let maxDiff = 0;
  let steepestDir = 0;
  const n8 = [[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
  const n8angle = [0, Math.PI/2, Math.PI, -Math.PI/2, Math.PI/4, 3*Math.PI/4, -Math.PI/4, -3*Math.PI/4];
  for (let i = 0; i < 8; i++) {
    const nx = x + n8[i][0], ny = y + n8[i][1];
    if (nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE) {
      const diff = Math.abs(elev - hm[ny * SIZE + nx]);
      if (diff > maxDiff) { maxDiff = diff; steepestDir = n8angle[i]; }
    }
  }
  const slope = Math.min(1, maxDiff * 50); // normalize

  return { lat, lon, elev, slope, aspect: steepestDir };
}

// ---- Latitude-dependent climate parameters ----

// Base annual temperature at sea level by latitude (simplified)
// Returns °C
export function baseTempByLatitude(lat: number): number {
  const absLat = Math.abs(lat);
  if (absLat < 10) return 27;
  if (absLat < 20) return 25;
  if (absLat < 30) return 20;
  if (absLat < 40) return 14;
  if (absLat < 50) return 5;
  if (absLat < 60) return -5;
  if (absLat < 70) return -15;
  return -25;
}

// Annual temperature range by latitude (continentality not yet applied)
export function tempRangeByLatitude(lat: number): number {
  const absLat = Math.abs(lat);
  if (absLat < 10) return 2;
  if (absLat < 20) return 5;
  if (absLat < 30) return 12;
  if (absLat < 40) return 20;
  if (absLat < 50) return 28;
  if (absLat < 60) return 35;
  if (absLat < 70) return 40;
  return 45;
}

// Coriolis parameter f = 2Ω·sin(φ)
// For wind deflection and geostrophic balance
export function coriolisParam(lat: number): number {
  return 2 * 7.292e-5 * Math.sin(lat * RAD);
}

// Prevailing surface wind direction by latitude (simplified 3-cell model)
// Returns direction in radians (meteorological: 0 = north, PI/2 = east)
export function prevailingWindDir(lat: number): number {
  const absLat = Math.abs(lat);
  if (absLat < 30) {
    // Trade winds: NE in NH, SE in SH → equatorward + westward
    return lat >= 0 ? Math.PI * 0.75 : Math.PI * 0.25; // NE trades / SE trades → ~easterly
  }
  if (absLat < 60) {
    // Westerlies: SW in NH, NW in SH → poleward + eastward
    return 0.25 * Math.PI; // westerly (~from west, blowing east)
  }
  // Polar easterlies
  return Math.PI * 0.75; // easterly
}

// ITCZ (Intertropical Convergence Zone) position by season
// Simplified: moves with the thermal equator
// Returns latitude of ITCZ center
export function itczLatitude(month: number): number {
  // ITCZ migrates between ~5°N (Jan) and ~10°N (Jul) over land,
  // more symmetric over ocean but we simplify
  return 7.5 * Math.sin(((month - 3) / 12) * Math.PI * 2);
}

// Precipitation factor from latitude alone (no terrain)
// Driven by pressure belts: low pressure = rain, high pressure = dry
export function latPrecipFactor(lat: number): number {
  const absLat = Math.abs(lat);
  if (absLat < 5) return 2.0;   // ITCZ — heavy rain
  if (absLat < 10) return 1.5;
  if (absLat < 25) return 0.3;  // Subtropical high — desert belt
  if (absLat < 35) return 0.5;
  if (absLat < 45) return 1.0;  // Mid-latitude — moderate
  if (absLat < 55) return 1.2;  // Subpolar low — wet
  if (absLat < 65) return 0.6;
  return 0.2;                   // Polar high — very dry
}

// Distance from ocean modifier (continentality)
// dWater: normalized 0-1, where 0 = ocean, 1 = deep interior
export function continentalityModifier(dWater: number): number {
  // Increases annual temperature range, decreases precipitation
  return 0.3 + dWater * 0.7; // multiplier for temp range
}

// Solar radiation at top of atmosphere by latitude (W/m² annual mean)
export function solarRadiation(lat: number): number {
  const absLat = Math.abs(lat);
  if (absLat < 10) return 420;
  if (absLat < 20) return 410;
  if (absLat < 30) return 380;
  if (absLat < 40) return 330;
  if (absLat < 50) return 270;
  if (absLat < 60) return 210;
  if (absLat < 70) return 160;
  return 130;
}
