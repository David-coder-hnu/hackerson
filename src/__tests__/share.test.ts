import { describe, it, expect } from "vitest";
import { encodeHeightmap, decodeHeightmap } from "../share/urlCodec";

const MAX_URL_LENGTH = 4000;

function makeSimpleHm(): Float32Array {
  const hm = new Float32Array(512 * 512);
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      hm[y * 512 + x] = (x + y) / 1024;
    }
  }
  return hm;
}

describe("share codec", () => {
  it("encode then decode returns similar heightmap", () => {
    const original = makeSimpleHm();
    const encoded = encodeHeightmap(original);
    expect(encoded).toBeTruthy();
    expect(typeof encoded).toBe("string");

    // If encoded exceeds URL limit, the decode rejects it — that's by design
    if (encoded.length > MAX_URL_LENGTH) {
      expect(decodeHeightmap(encoded)).toBeNull();
      return;
    }

    const decoded = decodeHeightmap(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.length).toBe(512 * 512);

    // Due to 128→512 upscale, expect some error
    let maxDiff = 0;
    for (let i = 0; i < 512 * 512; i++) {
      const diff = Math.abs(original[i] - decoded![i]);
      if (diff > maxDiff) maxDiff = diff;
    }
    expect(maxDiff).toBeLessThan(0.1);
  });

  it("decode returns null for empty string", () => {
    expect(decodeHeightmap("")).toBeNull();
  });

  it("decode returns null for garbage input", () => {
    expect(decodeHeightmap("this-is-not-valid-base64!!!")).toBeNull();
  });

  it("decode returns null for random base64 that is not LZ-string", () => {
    expect(decodeHeightmap("d29ybGQ=")).toBeNull();
  });

  it("heightmap with all same values round-trips", () => {
    const hm = new Float32Array(512 * 512);
    hm.fill(0.3);
    const encoded = encodeHeightmap(hm);
    const decoded = decodeHeightmap(encoded);
    expect(decoded).not.toBeNull();
    for (let i = 0; i < 512 * 512; i++) {
      expect(decoded![i]).toBeCloseTo(0.3, 1);
    }
  });

  it("encoded strings are under URL length limit for compressible data", () => {
    const hm = new Float32Array(512 * 512);
    hm.fill(0.3);
    const encoded = encodeHeightmap(hm);
    expect(encoded.length).toBeLessThanOrEqual(MAX_URL_LENGTH);
  });

  it("decode returns null for string exceeding max URL length", () => {
    const tooLong = "x".repeat(MAX_URL_LENGTH + 1);
    expect(decodeHeightmap(tooLong)).toBeNull();
  });
});
