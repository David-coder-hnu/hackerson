import { describe, it, expect } from "vitest";
import { applyBrushOp } from "../store/heightmap";
import type { BrushType } from "../types";

function makeFlatHm(fill: number = 0.2): Float32Array {
  const hm = new Float32Array(512 * 512);
  hm.fill(fill);
  return hm;
}

function cellAt(hm: Float32Array, x: number, y: number): number {
  return hm[y * 512 + x];
}

describe("applyBrushOp", () => {
  const cx = 256, cy = 256;

  it("raise increases center height", () => {
    const hm = makeFlatHm();
    applyBrushOp(hm, cx, cy, 20, 0.05, "raise");
    expect(cellAt(hm, cx, cy)).toBeGreaterThan(0.2);
  });

  it("raise falls off with distance", () => {
    const hm = makeFlatHm();
    applyBrushOp(hm, cx, cy, 10, 0.05, "raise");
    const center = cellAt(hm, cx, cy);
    const edge = cellAt(hm, cx + 8, cy);
    expect(edge).toBeLessThan(center);
    expect(edge).toBeGreaterThanOrEqual(0.2);
  });

  it("raise does not affect far cells", () => {
    const hm = makeFlatHm();
    applyBrushOp(hm, cx, cy, 5, 0.05, "raise");
    expect(cellAt(hm, 0, 0)).toBeCloseTo(0.2, 5);
  });

  it("lower decreases height", () => {
    const hm = makeFlatHm(0.3);
    applyBrushOp(hm, cx, cy, 20, 0.05, "lower");
    expect(cellAt(hm, cx, cy)).toBeLessThan(0.3);
  });

  it("lower does not go below 0", () => {
    const hm = makeFlatHm(0.01);
    applyBrushOp(hm, cx, cy, 20, 0.5, "lower");
    for (let i = 0; i < 512 * 512; i++) {
      expect(hm[i]).toBeGreaterThanOrEqual(0);
    }
  });

  it("raise does not exceed 1", () => {
    const hm = makeFlatHm(0.98);
    applyBrushOp(hm, cx, cy, 10, 0.5, "raise");
    for (let i = 0; i < 512 * 512; i++) {
      expect(hm[i]).toBeLessThanOrEqual(1);
    }
  });

  it("flatten pulls toward local average", () => {
    const hm = makeFlatHm(0.2);
    // Make a spike
    hm[cy * 512 + cx] = 0.9;
    applyBrushOp(hm, cx, cy, 15, 0.5, "flatten");
    const after = cellAt(hm, cx, cy);
    expect(after).toBeLessThan(0.9);
    expect(after).toBeGreaterThan(0.2);
  });

  it("smooth reduces variance", () => {
    const hm = makeFlatHm(0.3);
    // Create alternating values
    for (let x = 250; x <= 262; x++) {
      for (let y = 250; y <= 262; y++) {
        hm[y * 512 + x] = (x + y) % 2 === 0 ? 0.5 : 0.1;
      }
    }
    const before = cellAt(hm, cx, cx);
    applyBrushOp(hm, cx, cy, 10, 0.1, "smooth");
    const after = cellAt(hm, cx, cy);
    // Smoothing brings extreme toward center
    const center = 0.3;
    expect(Math.abs(after - center)).toBeLessThanOrEqual(Math.abs(before - center));
  });

  it("does not affect cells outside radius", () => {
    const hm = makeFlatHm();
    applyBrushOp(hm, 10, 10, 5, 0.5, "raise");
    // Cells at (256, 256) should be unchanged
    expect(cellAt(hm, 256, 256)).toBeCloseTo(0.2, 5);
  });

  it("handles all brush types without throwing", () => {
    const types: BrushType[] = ["raise", "lower", "flatten", "smooth", "water", "glacier"];
    for (const type of types) {
      const hm = makeFlatHm();
      expect(() => applyBrushOp(hm, cx, cy, 10, 0.05, type)).not.toThrow();
    }
  });

  it("glacier creates irregular terrain", () => {
    const hm = makeFlatHm(0.4);
    applyBrushOp(hm, cx, cy, 30, 0.1, "glacier");
    // Should lower some cells and leave variation
    let changed = 0;
    for (let i = 0; i < 512 * 512; i++) {
      if (hm[i] !== 0.4) changed++;
    }
    expect(changed).toBeGreaterThan(0);
  });
});
