import { describe, it, expect } from "vitest";
import { fillDepressions, d8FlowDir, flowAccumulation, detectLakes } from "../simulation/worker";

const SIZE = 512;

function idx(x: number, y: number): number {
  return y * SIZE + x;
}

function makeSlopeHm(): Float32Array {
  const hm = new Float32Array(SIZE * SIZE);
  // Uniform slope: NW high, SE low
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      hm[idx(x, y)] = 0.8 - (x + y) / (SIZE * 2) * 0.6;
    }
  }
  return hm;
}

describe("fillDepressions", () => {
  it("fills a single-pit depression", () => {
    const hm = new Float32Array(SIZE * SIZE);
    hm.fill(0.2);
    // Create a pit at center
    hm[idx(256, 256)] = 0.05;
    const filled = fillDepressions(hm, 0.15);
    // Pit should be raised at least to sea level or its lowest neighbor
    expect(filled[idx(256, 256)]).toBeGreaterThan(0.05);
  });

  it("does not change already drained terrain", () => {
    const hm = makeSlopeHm();
    const filled = fillDepressions(hm, 0.15);
    let changed = 0;
    for (let i = 0; i < SIZE * SIZE; i++) {
      if (Math.abs(filled[i] - hm[i]) > 0.0001) changed++;
    }
    // On a uniform slope, very few cells should change
    const changedPct = changed / (SIZE * SIZE);
    expect(changedPct).toBeLessThan(0.05);
  });

  it("sets boundary cells at or above sea level", () => {
    const hm = new Float32Array(SIZE * SIZE);
    hm.fill(0.05); // below sea level
    const filled = fillDepressions(hm, 0.15);
    // Boundary cells should be at sea level
    expect(filled[idx(0, 0)]).toBeGreaterThanOrEqual(0.15);
    expect(filled[idx(SIZE - 1, 0)]).toBeGreaterThanOrEqual(0.15);
    expect(filled[idx(0, SIZE - 1)]).toBeGreaterThanOrEqual(0.15);
  });
});

describe("d8FlowDir", () => {
  it("every cell on uniform slope has a valid flow direction", () => {
    const hm = makeSlopeHm();
    const dirs = d8FlowDir(hm);
    // All non-boundary cells should flow somewhere
    for (let y = 1; y < SIZE - 1; y++) {
      for (let x = 1; x < SIZE - 1; x++) {
        const d = dirs[idx(x, y)];
        expect(d).toBeGreaterThanOrEqual(0);
        expect(d).toBeLessThan(8);
      }
    }
  });

  it("flow direction is toward lower elevation", () => {
    const hm = makeSlopeHm();
    const dirs = d8FlowDir(hm);
    const neighbors = [[0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1], [1, 0], [1, -1]];
    // Spot check a few positions
    const checks = [[128, 128], [256, 256], [384, 384]];
    for (const [x, y] of checks) {
      const d = dirs[idx(x, y)];
      const nx = x + neighbors[d][0];
      const ny = y + neighbors[d][1];
      expect(hm[idx(nx, ny)]).toBeLessThan(hm[idx(x, y)]);
    }
  });

  it("flat terrain has no flow direction", () => {
    const hm = new Float32Array(SIZE * SIZE);
    hm.fill(0.3);
    const dirs = d8FlowDir(hm);
    // All interior cells should have -1 (no flow)
    for (let y = 1; y < SIZE - 1; y++) {
      for (let x = 1; x < SIZE - 1; x++) {
        expect(dirs[idx(x, y)]).toBe(-1);
      }
    }
  });
});

describe("flowAccumulation", () => {
  it("accumulator increases downstream", () => {
    const hm = makeSlopeHm();
    const dirs = d8FlowDir(hm);
    const accum = flowAccumulation(dirs);
    // Flow accumulation should be >= 1 everywhere
    for (let i = 0; i < SIZE * SIZE; i++) {
      expect(accum[i]).toBeGreaterThanOrEqual(1);
    }
  });

  it("outlet has highest accumulation on slope", () => {
    const hm = makeSlopeHm();
    const dirs = d8FlowDir(hm);
    const accum = flowAccumulation(dirs);
    // Bottom-right corner should have high accumulation
    // (water drains SE on this slope)
    const corner = accum[idx(SIZE - 2, SIZE - 2)];
    const topCorner = accum[idx(1, 1)];
    expect(corner).toBeGreaterThan(topCorner);
  });
});

describe("detectLakes", () => {
  it("finds pits in flat terrain with depressions", () => {
    const hm = new Float32Array(SIZE * SIZE);
    hm.fill(0.2);
    // Create a pit
    hm[idx(256, 256)] = 0.08;
    hm[idx(255, 256)] = 0.09;
    hm[idx(257, 256)] = 0.09;
    hm[idx(256, 255)] = 0.09;
    hm[idx(256, 257)] = 0.09;
    const dirs = d8FlowDir(hm);
    const lakes = detectLakes(hm, dirs);
    // Center should be a lake (pit with no outflow)
    expect(lakes[idx(256, 256)]).toBe(1);
  });

  it("does not mark boundary cells as lakes", () => {
    const hm = new Float32Array(SIZE * SIZE);
    hm.fill(0.2);
    const dirs = d8FlowDir(hm);
    const lakes = detectLakes(hm, dirs);
    // Boundary cells should NOT be lakes
    for (let x = 0; x < SIZE; x++) {
      expect(lakes[idx(x, 0)]).toBe(0);
      expect(lakes[idx(x, SIZE - 1)]).toBe(0);
    }
    for (let y = 0; y < SIZE; y++) {
      expect(lakes[idx(0, y)]).toBe(0);
      expect(lakes[idx(SIZE - 1, y)]).toBe(0);
    }
  });

  it("cells below sea level are not lakes", () => {
    const hm = new Float32Array(SIZE * SIZE);
    hm.fill(0.005); // below 0.01 threshold
    const dirs = d8FlowDir(hm);
    const lakes = detectLakes(hm, dirs);
    // No lake should be detected below threshold
    for (let i = 0; i < SIZE * SIZE; i++) {
      expect(lakes[i]).toBe(0);
    }
  });
});
