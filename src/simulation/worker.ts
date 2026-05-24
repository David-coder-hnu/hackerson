import { classifyKoppen, generateMonthlyTemp, generateMonthlyPrecip } from "./koppen";
import { classifyHoldridge, inferSoil, recommendPlants } from "./biome";
import type { KoppenResult } from "./koppen";
import type { HoldridgeZone, SoilType, HabitatPlants } from "./biome";
import {
  cellLat, cellLon, baseTempByLatitude,
  prevailingWindDir, latPrecipFactor, getCellGeo,
} from "./geo";
import { getWildlife, getMinerals, getCityPotential } from "./knowledge";
import { HEIGHTMAP_SIZE } from "../types";

declare function postMessage(message: any, transfer?: Transferable[]): void;
declare var onmessage: ((this: Window, ev: MessageEvent) => any) | null;

const SIZE = HEIGHTMAP_SIZE;

function idx(x: number, y: number): number { return y * SIZE + x; }
function inBounds(x: number, y: number): boolean { return x >= 0 && x < SIZE && y >= 0 && y < SIZE; }

export function fillDepressions(hm: Float32Array, seaLevel: number): Float32Array {
  const filled = new Float32Array(hm);
  const closed = new Uint8Array(SIZE * SIZE);
  const pq: [number, number, number][] = [];

  function push(x: number, y: number) {
    const val = filled[idx(x, y)];
    let i = pq.length;
    pq.push([val, x, y]);
    while (i > 0 && pq[i - 1][0] > val) {
      pq[i] = pq[i - 1];
      i--;
    }
    pq[i] = [val, x, y];
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

export function d8FlowDir(hm: Float32Array): Int8Array {
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

export function flowAccumulation(dirs: Int8Array): Float32Array {
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

// Trace river paths from D8 directions — returns arrays of [x,y] segments
function traceRiverPaths(
  dirs: Int8Array,
  accum: Float32Array,
  threshold: number,
  maxPaths: number
): number[][][] {
  const paths: number[][][] = [];
  const visited = new Uint8Array(SIZE * SIZE);
  const neighbors = [[0,-1],[-1,-1],[-1,0],[-1,1],[0,1],[1,1],[1,0],[1,-1]];

  // Find top source cells by flow accumulation
  const sources: [number, number, number][] = []; // [accum, x, y]
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = idx(x, y);
      if (accum[i] > threshold && !visited[i]) {
        // Check if this is a "source" — no upstream cells, or high accumulation
        const d = dirs[i];
        if (d >= 0) {
          const nx = x + neighbors[d][0], ny = y + neighbors[d][1];
          if (inBounds(nx, ny) && accum[idx(nx, ny)] > accum[i] * 0.8) continue; // has meaningful downstream
        }
        sources.push([accum[i], x, y]);
      }
    }
  }
  sources.sort((a, b) => b[0] - a[0]);

  // Trace from top sources
  for (let s = 0; s < Math.min(sources.length, maxPaths); s++) {
    const [, sx, sy] = sources[s];
    if (visited[idx(sx, sy)]) continue;

    const path: number[][] = [];
    let x = sx, y = sy;
    let steps = 0;
    while (steps < SIZE * 2) {
      const i = idx(x, y);
      if (visited[i] && steps > 10) break; // hit existing path — merge
      visited[i] = 1;
      path.push([x, y]);

      const d = dirs[i];
      if (d < 0) break; // sink
      x += neighbors[d][0];
      y += neighbors[d][1];
      if (!inBounds(x, y)) break;
      steps++;
    }
    if (path.length > 3) paths.push(path);
  }

  return paths;
}

// Flood-fill lake regions
function extractLakeRegions(lakeMask: Uint8Array, maxLakes: number): number[][][] {
  const visited = new Uint8Array(SIZE * SIZE);
  const regions: number[][][] = [];

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = idx(x, y);
      if (!lakeMask[i] || visited[i]) continue;

      // BFS flood fill
      const cells: number[][] = [];
      const queue: [number, number][] = [[x, y]];
      visited[i] = 1;

      while (queue.length > 0) {
        const [cx, cy] = queue.shift()!;
        cells.push([cx, cy]);
        for (const [dx, dy] of [[0,1],[0,-1],[1,0],[-1,0]]) {
          const nx = cx + dx, ny = cy + dy;
          if (!inBounds(nx, ny)) continue;
          const ni = idx(nx, ny);
          if (lakeMask[ni] && !visited[ni]) {
            visited[ni] = 1;
            queue.push([nx, ny]);
          }
        }
      }

      if (cells.length > 4) regions.push(cells);
      if (regions.length >= maxLakes) break;
    }
    if (regions.length >= maxLakes) break;
  }

  return regions;
}

export function detectLakes(hm: Float32Array, dirs: Int8Array): Uint8Array {
  const lakes = new Uint8Array(SIZE * SIZE);
  const n8 = [[0,-1],[-1,-1],[-1,0],[-1,1],[0,1],[1,1],[1,0],[1,-1]];
  for (let y = 1; y < SIZE - 1; y++)
    for (let x = 1; x < SIZE - 1; x++) {
      if (dirs[idx(x, y)] >= 0) continue;
      const h = hm[idx(x, y)];
      let isPit = true;
      for (const [dx, dy] of n8) {
        const nx = x + dx, ny = y + dy;
        if (hm[idx(nx, ny)] < h) { isPit = false; break; }
      }
      if (isPit && h > 0.01) lakes[idx(x, y)] = 1;
    }
  return lakes;
}

// ---- Compute distance to nearest coastline (BFS from ocean cells) ----
function computeCoastDist(hm: Float32Array, seaLevel: number): Float32Array {
  const dist = new Float32Array(SIZE * SIZE).fill(999);
  const queue: [number, number][] = [];

  // Seed: ocean cells (below sea level)
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (hm[idx(x, y)] < seaLevel) {
        dist[idx(x, y)] = 0;
        queue.push([x, y]);
      }
    }
  }

  // BFS
  let head = 0;
  const n4 = [[0,1],[0,-1],[1,0],[-1,0]];
  while (head < queue.length) {
    const [cx, cy] = queue[head++];
    const cd = dist[idx(cx, cy)];
    for (const [dx, dy] of n4) {
      const nx = cx + dx, ny = cy + dy;
      if (!inBounds(nx, ny)) continue;
      if (dist[idx(nx, ny)] > cd + 1) {
        dist[idx(nx, ny)] = cd + 1;
        queue.push([nx, ny]);
      }
    }
  }
  return dist;
}

// ---- Full climate model using all geo knowledge ----
let _coastDist: Float32Array = new Float32Array(0);

function computeClimateFields(
  hm: Float32Array,
  seaLevel: number
): { precipMap: Float32Array; tempMap: Float32Array } {
  const precip = new Float32Array(SIZE * SIZE);
  const temp = new Float32Array(SIZE * SIZE);
  const coastDist = computeCoastDist(hm, seaLevel);
  _coastDist = coastDist; // save for pin analysis
  const maxCoastDist = 150; // normalize continentality at ~150 cells inland
  const tempLapseRate = 6.5;

  for (let y = 0; y < SIZE; y++) {
    const lat = cellLat(y);
    const baseT = baseTempByLatitude(lat);
    const latPrecip = latPrecipFactor(lat);
    const windDir = prevailingWindDir(lat);
    const wx = Math.cos(windDir), wy = Math.sin(windDir);
    const coriolis = Math.abs(lat) > 10 ? 1 + Math.abs(lat) / 60 : 1; // Coriolis strength

    for (let x = 0; x < SIZE; x++) {
      const i = idx(x, y);
      const elev = hm[i] * 10; // km
      const geo = getCellGeo(x, y, hm);
      const cdist = Math.min(coastDist[i], maxCoastDist);
      const continentality = cdist / maxCoastDist; // 0=coastal, 1=deep interior

      // === TEMPERATURE ===
      // Base: latitude + lapse rate
      let t = baseT - elev * tempLapseRate;

      // Continentality: interior = hotter summer, colder winter → wider annual range
      // (annual mean effect is small; primarily affects seasonality)
      t += continentality * 2; // slight warming in interior (summer-dominated effect)

      // Aspect: south-facing slopes (NH) are warmer
      const absLat = Math.abs(lat);
      if (absLat > 15 && geo.slope > 0.01) {
        const southFacing = Math.cos(geo.aspect - Math.PI); // 0 = south-facing (NH)
        t += southFacing * geo.slope * 3 * (lat >= 0 ? 1 : -1);
      }

      // Coastal moderation: coastal areas have milder temps
      t -= (1 - continentality) * 1.5;

      // Cold air drainage: basin bottoms are colder at night (simplified as annual effect)
      if (geo.slope < 0.005 && elev > 0.8) {
        t -= 2; // high plateau cold trap
      }

      temp[i] = t;

      // === PRECIPITATION ===
      let p = latPrecip * 0.3;

      // Orographic lift: lookback along wind (4 steps, reduced for performance)
      let totalLift = 0;
      for (let step = 2; step <= 8; step += 2) {
        const sx = Math.round(x - wx * step);
        const sy = Math.round(y - wy * step);
        if (!inBounds(sx, sy)) break;
        const prevH = hm[idx(sx, sy)];
        const lift = (elev - prevH * 10);
        if (lift > 0) totalLift += lift * Math.exp(-step / 5);
      }
      p += totalLift * 0.06;

      // Rain shadow: detect upwind barriers
      let maxUpwindH = 0;
      for (let step = 2; step <= 10; step += 2) {
        const sx = Math.round(x - wx * step);
        const sy = Math.round(y - wy * step);
        if (!inBounds(sx, sy)) break;
        maxUpwindH = Math.max(maxUpwindH, hm[idx(sx, sy)] * 10);
      }
      const barrierHeight = maxUpwindH - elev;
      if (barrierHeight > 0.5) {
        p -= barrierHeight * 0.06 * coriolis;
      }

      // Mountain peak precipitation (high peaks force air up on both sides)
      if (elev > 1.5 && geo.slope > 0.02) {
        p += geo.slope * 2.0 * (1 + (elev - 1.5) * 0.5);
      }

      // Coastal moisture: exponentially decaying with distance from coast
      p += Math.exp(-cdist / 30) * 0.25;

      // Continentality drying: interior far from any ocean is drier
      p -= continentality * 0.20;

      // ITCZ proximity bonus (tropical convergence zone)
      const itczLat = 7.5; // annual mean
      const itczDist = Math.abs(lat - itczLat) / 30;
      if (itczDist < 1) {
        p += (1 - itczDist) * 0.3;
      }

      // Slope aspect: windward slopes get more, leeward less
      if (geo.slope > 0.02) {
        const windAlignment = Math.cos(geo.aspect - windDir);
        p += windAlignment * geo.slope * 0.8;
      }

      precip[i] = Math.max(0, Math.min(1, p));
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
  avgLat: number;
} {
  let sumT = 0, sumP = 0, minT = Infinity, maxT = -Infinity;
  let landCells = 0, maxH = 0, sumSlope = 0, sumLat = 0;

  for (let y = 0; y < SIZE; y++) {
    const lat = cellLat(y);
    for (let x = 0; x < SIZE; x++) {
      const i = idx(x, y);
      const t = tempMap[i];
      sumT += t; sumP += precipMap[i];
      if (t < minT) minT = t;
      if (t > maxT) maxT = t;
      if (hm[i] > seaLevel) {
        landCells++;
        if (hm[i] > maxH) maxH = hm[i];
        sumLat += lat;
        const geo = getCellGeo(x, y, hm);
        sumSlope += geo.slope;
      }
    }
  }

  const n = SIZE * SIZE;
  const avgT = sumT / n;
  const avgPmm = (sumP / n) * 3000;
  const annualRange = Math.max(maxT - minT, 5);
  const avgLat = landCells > 0 ? sumLat / landCells : 0;

  // Use latitude-aware monthly profiles
  const hemisphere: "N" | "S" = avgLat >= 0 ? "N" : "S";
  const seasonalPeak = "summer";
  const monthlyTemp = generateMonthlyTemp(avgT, annualRange, hemisphere);
  const monthlyPrecip = generateMonthlyPrecip(avgPmm, seasonalPeak);

  return {
    avgTemp: avgT, avgPrecip: avgPmm, annualRange,
    monthlyTemp, monthlyPrecip,
    landArea: landCells, maxElev: maxH,
    avgSlope: landCells > 0 ? sumSlope / landCells : 0,
    avgLat,
  };
}

// ---- Main handler ----
try { onmessage = (e: MessageEvent) => {
  const msg = e.data;
  if (msg.type !== "SIMULATE") return;

  const hm = new Float32Array(msg.heightmap);
  const windDir = msg.windDirection as number;
  const seaLevel = msg.seaLevel as number;
  const pins: Array<{ x: number; y: number }> = msg.pins || [];

  // Hydrology
  const filled = fillDepressions(hm, seaLevel);
  const dirs = d8FlowDir(filled);
  const accum = flowAccumulation(dirs);
  const riverMask = extractRivers(accum, SIZE * 0.5);
  const lakeMask = detectLakes(filled, dirs);
  const riverPaths = traceRiverPaths(dirs, accum, SIZE * 0.5, 40);
  const lakeRegions = extractLakeRegions(lakeMask, 20);

  // Transfer binary data via buffers
  const rMaskBuf = riverMask.buffer;
  const lMaskBuf = lakeMask.buffer;
  const accumBuf = accum.buffer;
  postMessage(
    { phase: "hydrology", riverMask: rMaskBuf, lakeMask: lMaskBuf, flowAccum: accumBuf, riverPaths, lakeRegions },
    [rMaskBuf, lMaskBuf, accumBuf]
  );

  // Climate
  const { precipMap, tempMap } = computeClimateFields(filled, seaLevel);
  const stats = climateStats(tempMap, precipMap, filled, seaLevel);

  // Köppen classification
  const koppen: KoppenResult = classifyKoppen(stats.monthlyTemp, stats.monthlyPrecip, stats.avgLat >= 0 ? "N" : "S");

  // Holdridge life zone
  const holdridge: HoldridgeZone = classifyHoldridge(stats.monthlyTemp, stats.avgPrecip, stats.maxElev * 3000);

  // Soil inference
  const soils: SoilType[] = inferSoil(koppen.code, stats.avgTemp, stats.avgPrecip, stats.maxElev * 3000, stats.avgSlope * 100);

  // Plant recommendations
  const plants: HabitatPlants[] = recommendPlants(koppen.code);

  // ---- Per-pin local analysis ----
  const pinAnalyses = pins.map((pin) => {
    const pi = idx(pin.x, pin.y);
    const lat = cellLat(pin.y);
    const lon = cellLon(pin.x);
    const elev = (hm[pi] - seaLevel) * 3000; // meters relative to sea level
    const geo = getCellGeo(pin.x, pin.y, hm);
    const cdist = _coastDist[pi];
    const coastKm = Math.round(cdist * 10) / 10; // ~10km per cell

    // Local temp and precip
    const localT = tempMap[pi];
    const localP = precipMap[pi] * 3000; // mm

    // Aspect name
    const aspectNames = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const aspectIdx = Math.round(((geo.aspect % (2 * Math.PI)) / (Math.PI / 4)) + 8) % 8;
    const aspect = aspectNames[aspectIdx];

    // Slope in degrees
    const slopeDeg = Math.round(Math.atan(geo.slope * 50) * 180 / Math.PI);

    // Pressure belt
    const absLat = Math.abs(lat);
    let pressureBelt: string;
    if (absLat < 5) pressureBelt = "赤道低压带(ITCZ)";
    else if (absLat < 25) pressureBelt = "副热带高压带";
    else if (absLat < 35) pressureBelt = "副热带高压→西风过渡";
    else if (absLat < 60) pressureBelt = "西风带";
    else if (absLat < 70) pressureBelt = "副极地低压带";
    else pressureBelt = "极地高压带";

    // Local monthly estimates
    const monthlyT = generateMonthlyTemp(localT, stats.annualRange, lat >= 0 ? "N" : "S");
    const monthlyP = generateMonthlyPrecip(localP, "summer");
    const localKoppen = classifyKoppen(monthlyT, monthlyP, lat >= 0 ? "N" : "S");
    const localHoldridge = classifyHoldridge(monthlyT, localP, elev);
    const localSoils = inferSoil(localKoppen.code, localT, localP, elev, slopeDeg);
    const localPlants = recommendPlants(localKoppen.code);

    // Crop recommendations based on climate
    const crops: string[] = [];
    if (localT > 10 && localP > 500) crops.push("小麦");
    if (localT > 15 && localP > 800) crops.push("玉米");
    if (localT > 20 && localP > 1000) crops.push("水稻");
    if (localT > 25 && localP > 1200) crops.push("甘蔗", "热带水果");
    if (localT > 5 && localT < 20 && localP > 400) crops.push("马铃薯", "大麦");
    if (localT < 5 && localP > 300) crops.push("黑麦", "燕麦");
    if (localP < 400) crops.push("旱作农业或灌溉农业");

    // Plant species names
    const plantNames = localPlants.flatMap(h => h.plants.map(p => p.name)).slice(0, 5);

    // Knowledge base lookups
    const terrainType = elev > 3000 ? "high_mountain" : elev > 1500 ? "low_mountain" : elev > 500 ? "hill" : slopeDeg < 3 ? "plain" : "hill";
    const wildlife = getWildlife(localKoppen.code).map(a => ({
      name: a.name_zh,
      size: a.body_size,
      diet: a.diet,
      habitat: a.activity_rhythm === "夜行" ? "林冠/洞穴" : "开阔/林缘",
      special: a.special_adaptation.slice(0, 40),
    }));
    const minerals = getMinerals(elev, slopeDeg, terrainType, localKoppen.code);
    const cityP = getCityPotential(elev, slopeDeg, coastKm, localP, localT, localSoils[0]?.wrb || "Cambisols");

    const desc = `${localKoppen.name}，${localHoldridge.biomeZh}。年均温${localT.toFixed(1)}°C，年降水${Math.round(localP)}mm。${localSoils[0]?.name || "雏形土"}。城镇潜力${cityP.score}/100。`;

    return {
      lat: Math.round(lat * 10) / 10, lon: Math.round(lon * 10) / 10,
      elevation: Math.round(elev), slope: slopeDeg, aspect,
      coastDist: coastKm,
      pressureBelt,
      koppen: `${localKoppen.code} ${localKoppen.name}`,
      holdridge: localHoldridge.biomeZh,
      soil: localSoils[0]?.name || "雏形土",
      plants: plantNames,
      crops,
      tempAnnual: Math.round(localT * 10) / 10,
      precipAnnual: Math.round(localP),
      description: desc,
      animals: wildlife,
      minerals,
      cityPotential: cityP,
    };
  });

  // Terrain classification — percentile-based on land cells (> sea level)
  const landHeights: number[] = [];
  for (let i = 0; i < SIZE * SIZE; i++) {
    if (hm[i] > seaLevel) landHeights.push(hm[i]);
  }
  landHeights.sort((a, b) => a - b);
  const n = landHeights.length;
  const p25 = n > 0 ? landHeights[Math.floor(n * 0.25)] : 0;
  const p50 = n > 0 ? landHeights[Math.floor(n * 0.50)] : 0;
  const p90 = n > 0 ? landHeights[Math.floor(n * 0.90)] : 0;

  let mountain = 0, basin = 0, plain = 0, plateau = 0;
  for (let i = 0; i < SIZE * SIZE; i++) {
    const h = hm[i];
    if (h <= seaLevel) continue;
    if (h > p90) mountain++;
    else if (h < p25) basin++;
    else if (h < p50) plain++;
    else plateau++;
  }
  const total = SIZE * SIZE;
  const landTotal = n || 1;

  // Hydrology stats from traced paths and regions
  const riverCount = Math.round(riverPaths.reduce((s, p) => s + p.length, 0));
  const lakeCount = Math.round(lakeRegions.reduce((s, r) => s + r.length, 0));

  postMessage(
    { phase: "climate", precipMap: precipMap.buffer, tempMap: tempMap.buffer },
    [precipMap.buffer, tempMap.buffer]
  );

  postMessage({
    phase: "complete",
    analysis: {
      terrain: {
        mountainPct: Math.round((mountain / landTotal) * 100),
        basinPct: Math.round((basin / landTotal) * 100),
        plainPct: Math.round((plain / landTotal) * 100),
        plateauPct: Math.round((plateau / landTotal) * 100),
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
      hydrology: { riverCount, lakeCount, watershedArea: Math.round((landTotal / total) * 100) },
      soils: soils.map(s => ({ name: s.name, wrb: s.wrb, frequency: s.frequency, note: s.note, confidence: s.confidence })),
      plants: plants.map(p => ({
        habitat: p.habitat,
        description: p.description,
        species: p.plants.map(pl => ({ name: pl.name, uses: pl.uses.join("、"), rarity: pl.rarity })),
      })),
      landArea: Math.round((stats.landArea / total) * 100),
      pinAnalyses,
    },
  });
}; } catch { /* not in Worker context */ }
