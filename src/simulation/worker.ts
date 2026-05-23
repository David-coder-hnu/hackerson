import { classifyKoppen, generateMonthlyTemp, generateMonthlyPrecip } from "./koppen";
import { classifyHoldridge, inferSoil, recommendPlants } from "./biome";
import type { KoppenResult } from "./koppen";
import type { HoldridgeZone, SoilType, HabitatPlants } from "./biome";

declare function postMessage(message: any, transfer?: Transferable[]): void;
declare var onmessage: ((this: Window, ev: MessageEvent) => any) | null;

const SIZE = 512;

function idx(x: number, y: number): number { return y * SIZE + x; }
function inBounds(x: number, y: number): boolean { return x >= 0 && x < SIZE && y >= 0 && y < SIZE; }

// Depression filling (unchanged)
function fillDepressions(hm: Float32Array, seaLevel: number): Float32Array {
  const filled = new Float32Array(hm);
  const closed = new Uint8Array(SIZE * SIZE);
  const pq: [number, number, number][] = [];

  function push(x: number, y: number) {
    pq.push([filled[idx(x, y)], x, y]);
    pq.sort((a, b) => a[0] - b[0]);
  }

  for (let x = 0; x < SIZE; x++) {
    filled[idx(x, 0)] = Math.max(filled[idx(x, 0)], seaLevel);
    filled[idx(x, SIZE - 1)] = Math.max(filled[idx(x, SIZE - 1)], seaLevel);
    closed[idx(x, 0)] = 1; closed[idx(x, SIZE - 1)] = 1;
    push(x, 0); push(x, SIZE - 1);
  }
  for (let y = 1; y < SIZE - 1; y++) {
    filled[idx(0, y)] = Math.max(filled[idx(0, y)], seaLevel);
    filled[idx(SIZE - 1, y)] = Math.max(filled[idx(SIZE - 1, y)], seaLevel);
    closed[idx(0, y)] = 1; closed[idx(SIZE - 1, y)] = 1;
    push(0, y); push(SIZE - 1, y);
  }

  const dirs = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
  while (pq.length > 0) {
    const [h, cx, cy] = pq.shift()!;
    for (const [dx, dy] of dirs) {
      const nx = cx + dx, ny = cy + dy;
      if (!inBounds(nx, ny) || closed[idx(nx, ny)]) continue;
      if (filled[idx(nx, ny)] < h) filled[idx(nx, ny)] = h;
      closed[idx(nx, ny)] = 1;
      push(nx, ny);
    }
  }
  return filled;
}

// D8 flow direction (unchanged)
function d8FlowDir(hm: Float32Array): Int8Array {
  const dirs = new Int8Array(SIZE * SIZE).fill(-1);
  const neighbors = [[0,-1],[-1,-1],[-1,0],[-1,1],[0,1],[1,1],[1,0],[1,-1]];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const h = hm[idx(x, y)];
      let maxSlope = 0, bestDir = -1;
      for (let d = 0; d < 8; d++) {
        const nx = x + neighbors[d][0], ny = y + neighbors[d][1];
        if (!inBounds(nx, ny)) continue;
        const slope = (h - hm[idx(nx, ny)]) / (d % 2 === 0 ? 1 : Math.SQRT2);
        if (slope > maxSlope) { maxSlope = slope; bestDir = d; }
      }
      if (maxSlope > 0.0001) dirs[idx(x, y)] = bestDir;
    }
  }
  return dirs;
}

// Flow accumulation (unchanged)
function flowAccumulation(dirs: Int8Array): Float32Array {
  const accum = new Float32Array(SIZE * SIZE).fill(1);
  const indeg = new Int32Array(SIZE * SIZE);
  const neighbors = [[0,-1],[-1,-1],[-1,0],[-1,1],[0,1],[1,1],[1,0],[1,-1]];
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const d = dirs[idx(x, y)];
      if (d < 0) continue;
      const nx = x + neighbors[d][0], ny = y + neighbors[d][1];
      if (inBounds(nx, ny)) indeg[idx(nx, ny)]++;
    }

  const queue: number[] = [];
  for (let i = 0; i < SIZE * SIZE; i++) if (indeg[i] === 0) queue.push(i);

  while (queue.length > 0) {
    const i = queue.shift()!, x = i % SIZE, y = Math.floor(i / SIZE), d = dirs[i];
    if (d < 0) continue;
    const nx = x + neighbors[d][0], ny = y + neighbors[d][1];
    if (inBounds(nx, ny)) {
      const ni = idx(nx, ny);
      accum[ni] += accum[i];
      if (--indeg[ni] === 0) queue.push(ni);
    }
  }
  return accum;
}

function extractRivers(accum: Float32Array, threshold: number): Uint8Array {
  const rivers = new Uint8Array(SIZE * SIZE);
  for (let i = 0; i < SIZE * SIZE; i++) if (accum[i] > threshold) rivers[i] = 1;
  return rivers;
}

function detectLakes(hm: Float32Array, dirs: Int8Array): Uint8Array {
  const lakes = new Uint8Array(SIZE * SIZE);
  const n8 = [[0,-1],[-1,-1],[-1,0],[-1,1],[0,1],[1,1],[1,0],[1,-1]];
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      if (dirs[idx(x, y)] >= 0) continue;
      const h = hm[idx(x, y)];
      let isPit = true;
      for (const [dx, dy] of n8) {
        const nx = x + dx, ny = y + dy;
        if (!inBounds(nx, ny)) continue;
        if (hm[idx(nx, ny)] < h) { isPit = false; break; }
      }
      if (isPit && h > 0.01) lakes[idx(x, y)] = 1;
    }
  return lakes;
}

// ---- Climate model: elevation + wind → temperature + precipitation ----
function computeClimateFields(
  hm: Float32Array,
  windDir: number
): { precipMap: Float32Array; tempMap: Float32Array } {
  const precip = new Float32Array(SIZE * SIZE);
  const temp = new Float32Array(SIZE * SIZE);
  const tempLapseRate = 6.5, baseTemp = 25, precipScale = 0.8;
  const wx = Math.cos(windDir), wy = Math.sin(windDir);

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const h = hm[idx(x, y)];
      temp[idx(x, y)] = baseTemp - (h * 10) * tempLapseRate / 1000;
      let p = 0.3;
      const ux = Math.round(x - wx * 2), uy = Math.round(y - wy * 2);
      if (inBounds(ux, uy)) {
        const slope = (h - hm[idx(ux, uy)]) / 2;
        p += slope > 0 ? slope * precipScale * 2.0 : -Math.abs(slope) * precipScale;
      }
      precip[idx(x, y)] = Math.max(0, Math.min(1, p));
    }
  }
  return { precipMap: precip, tempMap: temp };
}

// ---- Aggregate climate stats for Köppen input ----
function climateStats(
  tempMap: Float32Array,
  precipMap: Float32Array,
  hm: Float32Array,
  seaLevel: number
): {
  avgTemp: number; avgPrecip: number; annualRange: number;
  monthlyTemp: number[]; monthlyPrecip: number[];
  landArea: number; maxElev: number; avgSlope: number;
} {
  let sumT = 0, sumP = 0, minT = Infinity, maxT = -Infinity;
  let landCells = 0, maxH = 0, sumSlope = 0;

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = idx(x, y);
      const t = tempMap[i];
      sumT += t; sumP += precipMap[i];
      if (t < minT) minT = t;
      if (t > maxT) maxT = t;
      if (hm[i] > seaLevel) {
        landCells++;
        if (hm[i] > maxH) maxH = hm[i];
        // Approximate slope
        const h0 = hm[i];
        const hx = x < SIZE - 1 ? hm[idx(x + 1, y)] : h0;
        const hy = y < SIZE - 1 ? hm[idx(x, y + 1)] : h0;
        sumSlope += Math.sqrt((hx - h0) ** 2 + (hy - h0) ** 2);
      }
    }
  }

  const n = SIZE * SIZE;
  const avgT = sumT / n;
  const avgPmm = (sumP / n) * 3000; // Convert [0,1] to approximate mm
  const annualRange = Math.max(maxT - minT, 5);

  // Generate monthly profiles
  const hemisphere: "N" | "S" = "N";
  const seasonalPeak = "summer"; // default
  const monthlyTemp = generateMonthlyTemp(avgT, annualRange, hemisphere);
  const monthlyPrecip = generateMonthlyPrecip(avgPmm, seasonalPeak);

  return {
    avgTemp: avgT, avgPrecip: avgPmm, annualRange,
    monthlyTemp, monthlyPrecip,
    landArea: landCells, maxElev: maxH,
    avgSlope: landCells > 0 ? sumSlope / landCells : 0,
  };
}

// ---- Main handler ----
onmessage = (e: MessageEvent) => {
  const msg = e.data;
  if (msg.type !== "SIMULATE") return;

  const hm = msg.heightmap as Float32Array;
  const windDir = msg.windDirection as number;
  const seaLevel = msg.seaLevel as number;

  // Hydrology
  const filled = fillDepressions(hm, seaLevel);
  const dirs = d8FlowDir(filled);
  const accum = flowAccumulation(dirs);
  const riverMask = extractRivers(accum, SIZE * 0.5);
  const lakeMask = detectLakes(filled, dirs);

  postMessage(
    { phase: "hydrology", riverMask: riverMask.buffer, lakeMask: lakeMask.buffer, flowAccum: accum.buffer },
    [riverMask.buffer, lakeMask.buffer, accum.buffer]
  );

  // Climate
  const { precipMap, tempMap } = computeClimateFields(filled, windDir);
  const stats = climateStats(tempMap, precipMap, filled, seaLevel);

  // Köppen classification
  const koppen: KoppenResult = classifyKoppen(stats.monthlyTemp, stats.monthlyPrecip);

  // Holdridge life zone
  const holdridge: HoldridgeZone = classifyHoldridge(stats.monthlyTemp, stats.avgPrecip, stats.maxElev * 3000);

  // Soil inference
  const soils: SoilType[] = inferSoil(koppen.code, stats.avgTemp, stats.avgPrecip, stats.maxElev * 3000, stats.avgSlope * 100);

  // Plant recommendations
  const plants: HabitatPlants[] = recommendPlants(koppen.code);

  // Terrain classification
  let mountain = 0, basin = 0, plain = 0, plateau = 0;
  for (let i = 0; i < SIZE * SIZE; i++) {
    const h = hm[i];
    if (h > 0.6) mountain++; else if (h < 0.1) basin++; else if (h < 0.3) plain++; else plateau++;
  }
  const total = SIZE * SIZE;

  // River & lake counts
  let riverCount = 0, lakeCount = 0, watershed = 0;
  for (let i = 0; i < SIZE * SIZE; i++) {
    if (riverMask[i]) riverCount++;
    if (lakeMask[i]) lakeCount++;
    if (accum[i] > 0) watershed++;
  }

  postMessage(
    { phase: "climate", precipMap: precipMap.buffer, tempMap: tempMap.buffer },
    [precipMap.buffer, tempMap.buffer]
  );

  postMessage({
    phase: "complete",
    analysis: {
      terrain: {
        mountainPct: Math.round((mountain / total) * 100),
        basinPct: Math.round((basin / total) * 100),
        plainPct: Math.round((plain / total) * 100),
        plateauPct: Math.round((plateau / total) * 100),
      },
      climate: {
        koppen,
        holdridge: {
          biome: holdridge.biome,
          biomeZh: holdridge.biomeZh,
          latBelt: holdridge.latBelt,
          humidity: holdridge.humidityProvince,
          bt: Math.round(holdridge.bt * 10) / 10,
          per: Math.round(holdridge.per * 100) / 100,
        },
        avgTemp: Math.round(stats.avgTemp * 10) / 10,
        avgPrecip: Math.round(stats.avgPrecip),
        annualRange: Math.round(stats.annualRange * 10) / 10,
        prevailingWind: ["Westerly", "Easterly", "Northerly", "Southerly"][Math.round(((windDir % (2 * Math.PI)) / (Math.PI / 2)) % 4)] ?? "Westerly",
      },
      hydrology: { riverCount, lakeCount, watershedArea: Math.round((watershed / total) * 100) },
      soils: soils.map(s => ({ name: s.name, wrb: s.wrb, frequency: s.frequency, note: s.note, confidence: s.confidence })),
      plants: plants.map(p => ({
        habitat: p.habitat,
        description: p.description,
        species: p.plants.map(pl => ({ name: pl.name, uses: pl.uses.join("、"), rarity: pl.rarity })),
      })),
      landArea: Math.round((stats.landArea / total) * 100),
    },
  });
};
