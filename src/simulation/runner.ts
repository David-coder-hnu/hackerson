import type { PlanetArchive } from "../types";

type ProgressCallback = (phase: string, data: any) => void;
type CompleteCallback = (archive: PlanetArchive) => void;
type ErrorCallback = (error: string) => void;

export function runSimulation(
  heightmap: Float32Array,
  opts: {
    onProgress?: ProgressCallback;
    onComplete?: CompleteCallback;
    onError?: ErrorCallback;
    timeout?: number;
  }
): Worker {
  const worker = new Worker(
    new URL("./worker.ts", import.meta.url),
    { type: "module" }
  );

  const timeout = setTimeout(() => {
    worker.terminate();
    opts.onError?.("模拟超时，请重试");
  }, opts.timeout ?? 30000);

  worker.onmessage = (e) => {
    const data = e.data;
    if (data.phase === "hydrology") {
      opts.onProgress?.("hydrology", {
        riverMask: new Uint8Array(data.riverMask),
        lakeMask: new Uint8Array(data.lakeMask),
        flowAccum: new Float32Array(data.flowAccum),
        riverPaths: data.riverPaths || [],
        lakeRegions: data.lakeRegions || [],
      });
    } else if (data.phase === "climate") {
      opts.onProgress?.("climate", {
        precipMap: new Float32Array(data.precipMap),
        tempMap: new Float32Array(data.tempMap),
      });
    } else if (data.phase === "complete") {
      clearTimeout(timeout);
      opts.onComplete?.(data.analysis);
      worker.terminate();
    }
  };

  worker.onerror = () => {
    clearTimeout(timeout);
    worker.terminate();
    opts.onError?.("模拟失败，请重试");
  };

  const hCopy = new Float32Array(heightmap);
  worker.postMessage(
    { type: "SIMULATE", heightmap: hCopy.buffer, windDirection: Math.PI / 2, seaLevel: 0.15 },
    [hCopy.buffer]
  );

  return worker;
}
