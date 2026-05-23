import { HEIGHTMAP_SIZE } from "../types";

const SZ = HEIGHTMAP_SIZE;

// ---- Improved noise functions ----
function hash(x: number, y: number, seed: number): number {
  let h = seed + x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return (h ^ (h >> 16)) / 2147483648;
}

function smoothNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  return (
    hash(ix, iy, seed) * (1 - sx) * (1 - sy) +
    hash(ix + 1, iy, seed) * sx * (1 - sy) +
    hash(ix, iy + 1, seed) * (1 - sx) * sy +
    hash(ix + 1, iy + 1, seed) * sx * sy
  );
}

function fbm(x: number, y: number, octaves: number, seed: number): number {
  let v = 0, amp = 0.5, freq = 1, maxV = 0;
  for (let i = 0; i < octaves; i++) {
    v += amp * smoothNoise(x * freq, y * freq, seed + i * 137);
    maxV += amp;
    freq *= 2.1;
    amp *= 0.55;
  }
  return v / maxV;
}

// Ridged noise — good for mountain ranges
function ridgedNoise(x: number, y: number, octaves: number, seed: number): number {
  let v = 0, amp = 0.5, freq = 1, maxV = 0;
  for (let i = 0; i < octaves; i++) {
    let n = Math.abs(smoothNoise(x * freq, y * freq, seed + i * 251));
    n = 1 - n; // invert to make ridges
    n = n * n; // sharpen ridges
    v += n * amp;
    maxV += amp;
    freq *= 2.0;
    amp *= 0.5;
  }
  return v / maxV;
}

// Domain warp for natural coastline distortion
function domainWarp(x: number, y: number, seed: number): [number, number] {
  const scale = 3.0;
  const strength = 0.4;
  const dx = smoothNoise(x * scale + 5.3, y * scale + 2.7, seed) * strength;
  const dy = smoothNoise(x * scale + 8.1, y * scale + 4.2, seed + 77) * strength;
  return [x + dx, y + dy];
}

// Continental shape: irregular mass with fractal coastline
function continentMask(x: number, y: number, cx: number, cy: number, rx: number, ry: number, seed: number): number {
  const [wx, wy] = domainWarp(x / rx, y / ry, seed);
  const dist = Math.sqrt((wx - cx / rx) ** 2 + (wy - cy / ry) ** 2);
  const edge = 0.6 + fbm(x / rx * 4, y / ry * 4, 3, seed + 42) * 0.4;
  return 1 - Math.min(1, Math.max(0, (dist - edge * 0.7) / 0.35));
}

// Mountain ridge along a line
function ridgeLine(x: number, y: number, x1: number, y1: number, x2: number, y2: number, width: number): number {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const nx = -dy / len, ny = dx / len;
  const distToLine = Math.abs((x - x1) * nx + (y - y1) * ny);
  const along = ((x - x1) * dx + (y - y1) * dy) / (len * len);
  const onSegment = along >= -0.1 && along <= 1.1;
  if (!onSegment) return 0;
  return Math.exp(-(distToLine * distToLine) / (2 * width * width));
}

// Smooth shelf transition
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// ============== PRESETS ==============

export type PresetName = "earthlike" | "subduction" | "rift" | "pangaea";

export const PRESETS: { name: string; key: PresetName }[] = [
  { name: "Earth-like", key: "earthlike" },
  { name: "Subduction Arc", key: "subduction" },
  { name: "Rift Valley", key: "rift" },
  { name: "Pangaea", key: "pangaea" },
];

export function generatePreset(key: PresetName): Float32Array {
  switch (key) {
    case "earthlike": return genEarthlike();
    case "subduction": return genSubduction();
    case "rift": return genRift();
    case "pangaea": return genPangaea();
  }
}

// ---- Earth-like continent ----
// Western cordillera (high, narrow), central plains, eastern old mountains (lower, eroded)
function genEarthlike(): Float32Array {
  const hm = new Float32Array(SZ * SZ);
  const cx = SZ * 0.45, cy = SZ * 0.48;

  for (let y = 0; y < SZ; y++) {
    for (let x = 0; x < SZ; x++) {
      const nx = x / SZ, ny = y / SZ;

      // Continental shape — irregular mass
      const mask = continentMask(x, y, cx, cy, SZ * 0.28, SZ * 0.32, 10);
      const shelfMask = continentMask(x, y, cx, cy, SZ * 0.35, SZ * 0.40, 10);

      // Base elevation: ocean floor
      let h = 0.03 + (1 - shelfMask) * 0.04;

      if (mask > 0.01) {
        // ---- Land ----
        // Base land height: ~0.15 (sea level) to ~0.35 (continental interior)
        const interior = 0.18 + mask * 0.25;

        // Western cordillera (along x ~ SZ*0.25 to SZ*0.40)
        const westRidge = ridgeLine(x, y, SZ * 0.22, SZ * 0.25, SZ * 0.35, SZ * 0.70, SZ * 0.04);
        const westRidge2 = ridgeLine(x, y, SZ * 0.28, SZ * 0.20, SZ * 0.40, SZ * 0.68, SZ * 0.03);
        const cordillera = Math.max(westRidge, westRidge2) * mask;

        // Eastern old mountains (Appalachian-style — lower, rounded)
        const eastRidge = ridgeLine(x, y, SZ * 0.58, SZ * 0.30, SZ * 0.65, SZ * 0.72, SZ * 0.06);
        const eastern = eastRidge * mask * 0.5;

        // Ridged noise for mountain texture
        const mountainNoise = ridgedNoise(nx * 12, ny * 12, 4, 99) * cordillera * 0.4;
        const hillNoise = fbm(nx * 8, ny * 8, 4, 77) * mask * 0.12;

        h = interior + cordillera * 0.45 + eastern * 0.25 + mountainNoise + hillNoise;
      } else if (shelfMask > 0.01) {
        // Continental shelf
        h = 0.07 + shelfMask * 0.06;
      }

      // Deep ocean in the far field
      if (x < SZ * 0.1 || x > SZ * 0.85) h -= 0.02;
      if (y < SZ * 0.1 || y > SZ * 0.85) h -= 0.02;

      hm[y * SZ + x] = Math.max(0, Math.min(1, h));
    }
  }
  return hm;
}

// ---- Subduction island arc ----
// Volcanic arc + deep trench on the subducting side
function genSubduction(): Float32Array {
  const hm = new Float32Array(SZ * SZ);
  const arcCx = SZ * 0.55, arcCy = SZ * 0.55;
  const arcAngle = -0.6; // radians, arc orientation

  for (let y = 0; y < SZ; y++) {
    for (let x = 0; x < SZ; x++) {
      const nx = x / SZ, ny = y / SZ;

      const dx = x - arcCx, dy = y - arcCy;
      const ry = dx * Math.sin(arcAngle) + dy * Math.cos(arcAngle);

      // Arc distance (curved)
      const arcDist = Math.abs(ry) / SZ;

      // Trench side: deep ocean where plate subducts (negative ry)
      const trenchDepth = ry < 0 ? Math.exp(-Math.abs(ry) / (SZ * 0.03)) * 0.06 : 0;
      const oceanBase = 0.03;

      // Volcanic arc ridge
      const arcRidge = Math.exp(-arcDist * arcDist * 60) * 0.55;
      const arcFracture = fbm(nx * 15, ny * 15, 3, 123) * 0.3;

      // Islands along the arc — several peaks
      let islandChain = 0;
      for (let i = 0; i < 6; i++) {
        const ix = arcCx + (i - 2.5) * SZ * 0.08;
        const iy = arcCy + Math.sin(i * 1.2) * SZ * 0.03;
        const idist = Math.sqrt((x - ix) ** 2 + (y - iy) ** 2);
        islandChain += Math.exp(-idist * idist / (SZ * SZ * 0.003)) * (0.3 + i * 0.05);
      }

      const land = arcRidge + islandChain + arcFracture * arcRidge;
      let h = oceanBase + land - trenchDepth;
      if (land < 0.12) h -= 0.02; // deeper ocean away from arc

      hm[y * SZ + x] = Math.max(0, Math.min(1, h));
    }
  }
  return hm;
}

// ---- Rift valley ----
// Two continental blocks pulling apart with a rift valley between
function genRift(): Float32Array {
  const hm = new Float32Array(SZ * SZ);
  const riftX = SZ * 0.5;

  for (let y = 0; y < SZ; y++) {
    for (let x = 0; x < SZ; x++) {
      const nx = x / SZ, ny = y / SZ;
      const dx = (x - riftX) / SZ; // distance from rift center
      const adx = Math.abs(dx);

      // Two continental blocks
      const leftBlock = smoothstep(0.08, 0.02, adx) * (1 - smoothstep(0.0, 0.03, adx));
      const rightBlock = smoothstep(0.08, 0.02, adx) * (1 - smoothstep(0.0, 0.03, adx));
      const blockBase = Math.max(leftBlock, rightBlock);

      // Rift valley — the actual split, lower elevation
      const rift = (1 - smoothstep(0.0, 0.06, adx)) * 0.25 * (1 - Math.exp(-adx * 40));

      // Block interior: high plateaus
      const plateau = blockBase * 0.55;

      // Fault-block mountains along rift edges (escarpments)
      const escarpL = Math.exp(-Math.abs(dx - 0.04) * 60) * 0.4;
      const escarpR = Math.exp(-Math.abs(dx + 0.04) * 60) * 0.4;
      const escarpments = (escarpL + escarpR) * blockBase;

      // Volcanic peaks in the rift (like Kilimanjaro)
      let volcanoes = 0;
      for (let i = 0; i < 4; i++) {
        const vx = riftX + (i - 1.5) * SZ * 0.015;
        const vy = SZ * (0.3 + i * 0.15);
        const vd = Math.sqrt((x - vx) ** 2 + (y - vy) ** 2);
        volcanoes += Math.exp(-vd * vd / (SZ * SZ * 0.001)) * 0.35;
      }

      // Terrain noise
      const noise = fbm(nx * 7, ny * 7, 4, 44) * 0.15;
      const ridgeDetail = ridgedNoise(nx * 10, ny * 10, 3, 88) * escarpments * 0.5;

      let h = 0.04 + plateau + escarpments + rift + volcanoes + noise + ridgeDetail;
      if (plateau < 0.05) h -= 0.02; // deeper ocean away from continents

      hm[y * SZ + x] = Math.max(0, Math.min(1, h));
    }
  }
  return hm;
}

// ---- Pangaea ----
// Single supercontinent with interior desert belt, coastal forests, backbone mountains
function genPangaea(): Float32Array {
  const hm = new Float32Array(SZ * SZ);
  const cx = SZ * 0.48, cy = SZ * 0.52;

  for (let y = 0; y < SZ; y++) {
    for (let x = 0; x < SZ; x++) {
      const nx = x / SZ, ny = y / SZ;
      const dx = (x - cx) / SZ, dy = (y - cy) / SZ;

      // Supercontinent shape — stretched E-W
      const rx = 0.38, ry = 0.25;
      const [wx, wy] = domainWarp(dx / rx, dy / ry, 55);
      const warpDist = Math.sqrt(wx * wx + wy * wy);
      const continent = 1 - Math.min(1, Math.max(0, (warpDist - 0.6) / 0.4));
      const shelf = 1 - Math.min(1, Math.max(0, (warpDist - 0.7) / 0.3));

      // Interior desert: dry subtropical belt (simulated)
      const interiorDry = 1 - Math.abs(dy) / 0.15;
      const interior = Math.max(0, interiorDry) * continent * 0.12;

      // Coastal moisture bands (greener near coasts)
      const coastProximity = continent * (1 - warpDist / 0.7);
      const coastalGreen = Math.max(0, coastProximity - 0.3) * 0.10;

      // Central mountain backbone (E-W, like the Variscan/Hercynian)
      const backbone = Math.exp(-(dy * dy) / 0.008) * continent * 0.55;
      const backboneDetail = ridgedNoise(nx * 14, ny * 14, 4, 33) * backbone * 0.5;

      // Peninsulas (southern edge)
      const southPeninsula = (y > SZ * 0.7 && continent > 0.5) ? continent * 0.2 : 0;

      // Terrain
      const noise = fbm(nx * 6, ny * 6, 5, 66) * 0.13;
      let h = 0.03 + continent * 0.18 + backbone + backboneDetail + interior + coastalGreen + noise + southPeninsula;
      if (continent < 0.2) h -= 0.02; // ocean

      // Continental shelf
      if (continent < 0.01 && shelf > 0.01) {
        h = 0.06 + shelf * 0.04;
      }

      hm[y * SZ + x] = Math.max(0, Math.min(1, h));
    }
  }
  return hm;
}

// Default
export function createDefaultHeightmap(): Float32Array {
  const hm = new Float32Array(SZ * SZ);
  hm.fill(0.08);
  return hm;
}
