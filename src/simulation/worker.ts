declare function postMessage(message: any, transfer?: Transferable[]): void;
declare var onmessage: ((this: Window, ev: MessageEvent) => any) | null;

const SIZE = 512;

function idx(x: number, y: number): number {
  return y * SIZE + x;
}

function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < SIZE && y >= 0 && y < SIZE;
}

// --- Depression filling via priority-queue (Planchon-Darboux simplified) ---
function fillDepressions(hm: Float32Array, seaLevel: number): Float32Array {
  const filled = new Float32Array(hm);
  const closed = new Uint8Array(SIZE * SIZE);
  const pq: [number, number, number][] = []; // [priority, x, y]

  function push(x: number, y: number) {
    const h = filled[idx(x, y)];
    pq.push([h, x, y]);
    pq.sort((a, b) => a[0] - b[0]);
  }
  function pop(): [number, number, number] {
    return pq.shift()!;
  }

  // Initialize border cells as boundaries
  for (let x = 0; x < SIZE; x++) {
    filled[idx(x, 0)] = Math.max(filled[idx(x, 0)], seaLevel);
    filled[idx(x, SIZE - 1)] = Math.max(filled[idx(x, SIZE - 1)], seaLevel);
    closed[idx(x, 0)] = 1;
    closed[idx(x, SIZE - 1)] = 1;
    push(x, 0);
    push(x, SIZE - 1);
  }
  for (let y = 1; y < SIZE - 1; y++) {
    filled[idx(0, y)] = Math.max(filled[idx(0, y)], seaLevel);
    filled[idx(SIZE - 1, y)] = Math.max(filled[idx(SIZE - 1, y)], seaLevel);
    closed[idx(0, y)] = 1;
    closed[idx(SIZE - 1, y)] = 1;
    push(0, y);
    push(SIZE - 1, y);
  }

  const dirs = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ];

  while (pq.length > 0) {
    const [h, cx, cy] = pop();
    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!inBounds(nx, ny) || closed[idx(nx, ny)]) continue;
      const nh = filled[idx(nx, ny)];
      if (nh < h) {
        filled[idx(nx, ny)] = h;
      }
      closed[idx(nx, ny)] = 1;
      push(nx, ny);
    }
  }

  return filled;
}

// --- D8 flow direction ---
function d8FlowDir(hm: Float32Array): Int8Array {
  const dirs = new Int8Array(SIZE * SIZE).fill(-1);
  const neighbors = [
    [0, -1],
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
    [1, 0],
    [1, -1],
  ];

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const h = hm[idx(x, y)];
      let maxSlope = 0;
      let bestDir = -1;
      for (let d = 0; d < 8; d++) {
        const nx = x + neighbors[d][0];
        const ny = y + neighbors[d][1];
        if (!inBounds(nx, ny)) continue;
        const nh = hm[idx(nx, ny)];
        const dist = d % 2 === 0 ? 1 : Math.SQRT2;
        const slope = (h - nh) / dist;
        if (slope > maxSlope) {
          maxSlope = slope;
          bestDir = d;
        }
      }
      if (maxSlope > 0.0001) {
        dirs[idx(x, y)] = bestDir;
      }
    }
  }
  return dirs;
}

// --- Flow accumulation ---
function flowAccumulation(dirs: Int8Array): Float32Array {
  const accum = new Float32Array(SIZE * SIZE).fill(1);
  const indeg = new Int32Array(SIZE * SIZE);
  const neighbors = [
    [0, -1],
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
    [1, 0],
    [1, -1],
  ];

  // Count incoming flow
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const d = dirs[idx(x, y)];
      if (d < 0) continue;
      const nx = x + neighbors[d][0];
      const ny = y + neighbors[d][1];
      if (inBounds(nx, ny)) {
        indeg[idx(nx, ny)]++;
      }
    }
  }

  // Topological sort from sources
  const queue: number[] = [];
  for (let i = 0; i < SIZE * SIZE; i++) {
    if (indeg[i] === 0) queue.push(i);
  }

  while (queue.length > 0) {
    const i = queue.shift()!;
    const x = i % SIZE;
    const y = Math.floor(i / SIZE);
    const d = dirs[i];
    if (d < 0) continue;
    const nx = x + neighbors[d][0];
    const ny = y + neighbors[d][1];
    if (inBounds(nx, ny)) {
      const ni = idx(nx, ny);
      accum[ni] += accum[i];
      indeg[ni]--;
      if (indeg[ni] === 0) queue.push(ni);
    }
  }

  return accum;
}

// --- Extract rivers ---
function extractRivers(
  accum: Float32Array,
  threshold: number
): Uint8Array {
  const rivers = new Uint8Array(SIZE * SIZE);
  for (let i = 0; i < SIZE * SIZE; i++) {
    rivers[i] = accum[i] > threshold ? 1 : 0;
  }
  return rivers;
}

// --- Lake detection ---
function detectLakes(hm: Float32Array, dirs: Int8Array): Uint8Array {
  const lakes = new Uint8Array(SIZE * SIZE);
  const neighbors = [
    [0, -1],
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
    [1, 0],
    [1, -1],
  ];

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const d = dirs[idx(x, y)];
      if (d >= 0) continue; // Has outflow — not a pit
      const h = hm[idx(x, y)];
      let isPit = true;
      for (const [dx, dy] of neighbors) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(nx, ny)) continue;
        if (hm[idx(nx, ny)] < h) {
          isPit = false;
          break;
        }
      }
      if (isPit && h > 0.01) {
        lakes[idx(x, y)] = 1;
      }
    }
  }
  return lakes;
}

// --- Climate model ---
const WIND_DIRS = ["Westerly", "Easterly", "Northerly", "Southerly"] as const;

function computeClimate(
  hm: Float32Array,
  windDir: number
): { precipMap: Float32Array; tempMap: Float32Array; prevailingWind: string } {
  const precip = new Float32Array(SIZE * SIZE);
  const temp = new Float32Array(SIZE * SIZE);
  const tempLapseRate = 6.5;
  const baseTemp = 25;
  const precipScale = 0.8;

  const windIdx = Math.round(((windDir % (2 * Math.PI)) / (Math.PI / 2)) % 4);
  const prevailingWind = WIND_DIRS[windIdx] || "Westerly";

  // Wind direction vector
  const wx = Math.cos(windDir);
  const wy = Math.sin(windDir);

  // Marching wind across the terrain — simple orographic model
  const scanOrder: [number, number][] = [];

  // Determine scan order based on wind direction
  const xRange = Array.from({ length: SIZE }, (_, i) => i);
  const yRange = Array.from({ length: SIZE }, (_, i) => i);

  if (wx >= 0) {
    // Wind blows left to right
    for (const y of yRange) {
      for (const x of xRange) {
        scanOrder.push([x, y]);
      }
    }
  } else {
    for (const y of yRange) {
      for (const x of xRange.reverse()) {
        scanOrder.push([x, y]);
      }
    }
  }

  // If wind has strong vertical component, we still scan horizontally
  // Simplified: 1D orographic model along wind direction

  for (const [x, y] of scanOrder) {
    const h = hm[idx(x, y)];

    // Temperature: lapse rate
    temp[idx(x, y)] = baseTemp - (h * 10) * tempLapseRate / 1000;

    // Precipitation: base + orographic lift
    let basePrecip = 0.3;

    // Look upwind to compute slope
    const ux = Math.round(x - wx * 2);
    const uy = Math.round(y - wy * 2);
    if (inBounds(ux, uy)) {
      const upwindH = hm[idx(ux, uy)];
      const slope = (h - upwindH) / 2;
      if (slope > 0) {
        basePrecip += slope * precipScale * 2.0; // Windward side — more rain
      } else {
        basePrecip -= Math.abs(slope) * precipScale * 1.0; // Leeward — rain shadow
      }
    }

    precip[idx(x, y)] = Math.max(0, Math.min(1, basePrecip));
  }

  return { precipMap: precip, tempMap: temp, prevailingWind };
}

// --- Biome classification helper ---
function classifyTerrain(hm: Float32Array): {
  mountainPct: number;
  basinPct: number;
  plainPct: number;
  plateauPct: number;
} {
  let mountain = 0;
  let basin = 0;
  let plain = 0;
  let plateau = 0;

  for (let i = 0; i < SIZE * SIZE; i++) {
    const h = hm[i];
    if (h > 0.6) mountain++;
    else if (h < 0.1) basin++;
    else if (h < 0.3) plain++;
    else plateau++;
  }

  const total = SIZE * SIZE;
  return {
    mountainPct: Math.round((mountain / total) * 100),
    basinPct: Math.round((basin / total) * 100),
    plainPct: Math.round((plain / total) * 100),
    plateauPct: Math.round((plateau / total) * 100),
  };
}

function classifyClimate(
  precipMap: Float32Array,
  tempMap: Float32Array
): Array<{ name: string; pct: number }> {
  let tropical = 0,
    temperate = 0,
    cold = 0,
    arid = 0;

  for (let i = 0; i < SIZE * SIZE; i++) {
    const t = tempMap[i];
    const p = precipMap[i];

    if (t > 20 && p > 0.3) tropical++;
    else if (t > 5 && t <= 20) temperate++;
    else if (t <= 5) cold++;
    else arid++;
  }

  const total = SIZE * SIZE;
  const zones: Array<{ name: string; pct: number }> = [];
  if (tropical > 0) zones.push({ name: "Tropical", pct: Math.round((tropical / total) * 100) });
  if (temperate > 0) zones.push({ name: "Temperate", pct: Math.round((temperate / total) * 100) });
  if (cold > 0) zones.push({ name: "Cold", pct: Math.round((cold / total) * 100) });
  if (arid > 0) zones.push({ name: "Arid", pct: Math.round((arid / total) * 100) });

  return zones.sort((a, b) => b.pct - a.pct);
}

// --- Main worker handler ---
onmessage = (e: MessageEvent) => {
  const msg = e.data;
  if (msg.type !== "SIMULATE") return;

  const hm = msg.heightmap as Float32Array;
  const windDir = msg.windDirection as number;
  const seaLevel = msg.seaLevel as number;

  // Step 1: Depression filling
  const filled = fillDepressions(hm, seaLevel);

  // Step 2: D8 flow direction
  const dirs = d8FlowDir(filled);

  // Step 3: Flow accumulation
  const accum = flowAccumulation(dirs);

  // Step 4: Rivers
  const threshold = SIZE * 0.5;
  const riverMask = extractRivers(accum, threshold);

  // Step 5: Lakes
  const lakeMask = detectLakes(filled, dirs);

  // Send hydrology results
  postMessage(
    {
      phase: "hydrology",
      riverMask: riverMask.buffer,
      lakeMask: lakeMask.buffer,
      flowAccum: accum.buffer,
    },
    [riverMask.buffer, lakeMask.buffer, accum.buffer]
  );

  // Step 6: Climate
  const { precipMap, tempMap, prevailingWind } = computeClimate(filled, windDir);

  // Step 7: Analysis
  const terrain = classifyTerrain(hm);
  const climateZones = classifyClimate(precipMap, tempMap);

  let riverCount = 0;
  let lakeCount = 0;
  let watershed = 0;
  for (let i = 0; i < SIZE * SIZE; i++) {
    if (riverMask[i]) riverCount++;
    if (lakeMask[i]) lakeCount++;
    if (accum[i] > 0) watershed++;
  }

  postMessage(
    {
      phase: "climate",
      precipMap: precipMap.buffer,
      tempMap: tempMap.buffer,
    },
    [precipMap.buffer, tempMap.buffer]
  );

  postMessage({
    phase: "complete",
    analysis: {
      terrain,
      climate: {
        zones: climateZones,
        prevailingWind,
      },
      hydrology: {
        riverCount,
        lakeCount,
        watershedArea: Math.round((watershed / (SIZE * SIZE)) * 100),
      },
    },
  });
};
