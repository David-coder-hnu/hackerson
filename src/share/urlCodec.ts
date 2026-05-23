import LZString from "lz-string";
import { HEIGHTMAP_SIZE } from "../types";

const SHARE_SIZE = 128; // Downscaled for URL
const MAX_URL_LENGTH = 4000;

export function encodeHeightmap(hm: Float32Array): string {
  // Downsample to 128×128 with 8-bit quantization
  const small = new Uint8Array(SHARE_SIZE * SHARE_SIZE);
  const scale = HEIGHTMAP_SIZE / SHARE_SIZE;

  for (let y = 0; y < SHARE_SIZE; y++) {
    for (let x = 0; x < SHARE_SIZE; x++) {
      const sx = Math.floor(x * scale);
      const sy = Math.floor(y * scale);
      const h = hm[sy * HEIGHTMAP_SIZE + sx];
      small[y * SHARE_SIZE + x] = Math.round(h * 255);
    }
  }

  // Convert to string then compress
  let binary = "";
  for (let i = 0; i < small.length; i++) {
    binary += String.fromCharCode(small[i]);
  }
  return LZString.compressToEncodedURIComponent(binary);
}

export function decodeHeightmap(hash: string): Float32Array | null {
  if (!hash || hash.length > MAX_URL_LENGTH) return null;

  try {
    const decompressed = LZString.decompressFromEncodedURIComponent(hash);
    if (!decompressed) return null;

    if (decompressed.length !== SHARE_SIZE * SHARE_SIZE) return null;

    const hm = new Float32Array(HEIGHTMAP_SIZE * HEIGHTMAP_SIZE);
    const small = new Uint8Array(SHARE_SIZE * SHARE_SIZE);
    for (let i = 0; i < decompressed.length; i++) {
      small[i] = decompressed.charCodeAt(i);
    }

    const scale = HEIGHTMAP_SIZE / SHARE_SIZE;
    // Upsample with bilinear interpolation
    for (let y = 0; y < HEIGHTMAP_SIZE; y++) {
      for (let x = 0; x < HEIGHTMAP_SIZE; x++) {
        const sx = (x / scale) % 1;
        const sy = (y / scale) % 1;
        const ix = Math.floor(x / scale);
        const iy = Math.floor(y / scale);
        const ix2 = Math.min(ix + 1, SHARE_SIZE - 1);
        const iy2 = Math.min(iy + 1, SHARE_SIZE - 1);

        const v00 = small[iy * SHARE_SIZE + ix] / 255;
        const v10 = small[iy * SHARE_SIZE + ix2] / 255;
        const v01 = small[iy2 * SHARE_SIZE + ix] / 255;
        const v11 = small[iy2 * SHARE_SIZE + ix2] / 255;

        const v0 = v00 + (v10 - v00) * sx;
        const v1 = v01 + (v11 - v01) * sx;
        hm[y * HEIGHTMAP_SIZE + x] = v0 + (v1 - v0) * sy;
      }
    }

    return hm;
  } catch {
    return null;
  }
}

export function getShareUrl(hm: Float32Array): string {
  const hash = encodeHeightmap(hm);
  return `${window.location.origin}${window.location.pathname}#${hash}`;
}

export function getHashFromUrl(): string | null {
  const hash = window.location.hash.slice(1);
  return hash || null;
}
