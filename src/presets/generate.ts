import { HEIGHTMAP_SIZE } from "../types";

// Simple 2D Simplex-like noise
function noise2D(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
  return n - Math.floor(n);
}

function fbm2D(x: number, y: number, octaves: number, seed: number): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let maxValue = 0;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * noise2D(x * frequency, y * frequency, seed + i * 100);
    maxValue += amplitude;
    frequency *= 2;
    amplitude *= 0.5;
  }
  return value / maxValue;
}

export type PresetName = "volcanic-island" | "mountain-chain" | "crater-lake" | "archipelago";

export const PRESETS: { name: string; key: PresetName }[] = [
  { name: "Volcanic Island", key: "volcanic-island" },
  { name: "Mountain Chain", key: "mountain-chain" },
  { name: "Crater Lake", key: "crater-lake" },
  { name: "Archipelago", key: "archipelago" },
];

export function generatePreset(key: PresetName): Float32Array {
  const hm = new Float32Array(HEIGHTMAP_SIZE * HEIGHTMAP_SIZE);
  const cx = HEIGHTMAP_SIZE / 2;
  const cy = HEIGHTMAP_SIZE / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);

  for (let y = 0; y < HEIGHTMAP_SIZE; y++) {
    for (let x = 0; x < HEIGHTMAP_SIZE; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / maxDist;
      const nx = x / HEIGHTMAP_SIZE;
      const ny = y / HEIGHTMAP_SIZE;
      const noise = fbm2D(nx * 6, ny * 6, 3, 42);
      let h = 0.15; // sea level base

      switch (key) {
        case "volcanic-island": {
          const peak = Math.exp(-dist * 3) * 0.85;
          const ridge = noise * 0.2;
          const oceanDepth = 0.02 + dist * 0.05;
          h = oceanDepth + peak + ridge;
          break;
        }
        case "mountain-chain": {
          const dx = Math.abs(x - cx) / cx;
          const ridgeVal = Math.exp(-dx * 1.5) * 0.7;
          const sideVal = Math.exp(-dx * 4) * 0.3;
          const landMass = ridgeVal + sideVal;
          h = 0.04 + landMass + noise * 0.2;
          break;
        }
        case "crater-lake": {
          const rim = Math.exp(-Math.abs(dist - 0.2) * 15) * 0.6;
          const inner = Math.exp(-dist * 5) * 0.15;
          const landMass = rim + inner;
          h = 0.04 + landMass + noise * 0.1;
          break;
        }
        case "archipelago": {
          const island1 = Math.exp(-(((x - cx * 0.6) ** 2 + (y - cy * 0.5) ** 2) / 4000)) * 0.5;
          const island2 = Math.exp(-(((x - cx * 1.5) ** 2 + (y - cy * 1.3) ** 2) / 3000)) * 0.6;
          const island3 = Math.exp(-(((x - cx * 0.8) ** 2 + (y - cy * 1.6) ** 2) / 3500)) * 0.45;
          const landMass = island1 + island2 + island3;
          const oceanDepth = 0.02 - landMass * 0.02;
          h = oceanDepth + landMass + noise * 0.10;
          break;
        }
      }

      hm[y * HEIGHTMAP_SIZE + x] = Math.max(0, Math.min(1, h));
    }
  }

  return hm;
}

// Default: shallow ocean with depth variation
export function createDefaultHeightmap(): Float32Array {
  const hm = new Float32Array(HEIGHTMAP_SIZE * HEIGHTMAP_SIZE);
  for (let y = 0; y < HEIGHTMAP_SIZE; y++) {
    for (let x = 0; x < HEIGHTMAP_SIZE; x++) {
      const nx = x / HEIGHTMAP_SIZE;
      const ny = y / HEIGHTMAP_SIZE;
      // Large-scale depth variation: deeper toward edges, some ridges
      const dist = Math.sqrt((nx - 0.5) ** 2 + (ny - 0.5) ** 2);
      const depth = 0.02 + dist * 0.05 + noise2D(nx * 3, ny * 3, 77) * 0.02;
      hm[y * HEIGHTMAP_SIZE + x] = Math.max(0, Math.min(1, depth));
    }
  }
  return hm;
}
