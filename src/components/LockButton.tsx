import { useHeightmapStore } from "../store/heightmap";
import { useRef } from "react";

export default function LockButton() {
  const mode = useHeightmapStore((s) => s.mode);
  const heightmap = useHeightmapStore((s) => s.heightmap);
  const setMode = useHeightmapStore((s) => s.setMode);
  const setSimProgress = useHeightmapStore((s) => s.setSimProgress);
  const setArchive = useHeightmapStore((s) => s.setArchive);
  const workerRef = useRef<Worker | null>(null);

  if (mode !== "edit") return null;

  const handleLock = () => {
    if (!heightmap) return;
    setMode("simulating");
    setSimProgress(null);
    setArchive(null);

    const worker = new Worker(
      new URL("../simulation/worker.ts", import.meta.url),
      { type: "module" }
    );
    workerRef.current = worker;

    const timeout = setTimeout(() => {
      worker.terminate();
      workerRef.current = null;
      setMode("edit");
      alert("Simulation timed out. Please try again.");
    }, 30000);

    worker.onmessage = (e) => {
      const data = e.data;
      if (data.phase === "hydrology") {
        setSimProgress({
          phase: "hydrology",
          riverMask: new Uint8Array(data.riverMask),
          lakeMask: new Uint8Array(data.lakeMask),
          flowAccum: new Float32Array(data.flowAccum),
        });
      } else if (data.phase === "climate") {
        const prev = useHeightmapStore.getState().simProgress;
        setSimProgress({
          phase: "climate",
          riverMask: prev?.riverMask,
          lakeMask: prev?.lakeMask,
          flowAccum: prev?.flowAccum,
          precipMap: new Float32Array(data.precipMap),
          tempMap: new Float32Array(data.tempMap),
        });
      } else if (data.phase === "complete") {
        clearTimeout(timeout);
        setArchive(data.analysis);
        setMode("observing");
        worker.terminate();
        workerRef.current = null;
      }
    };

    worker.onerror = () => {
      clearTimeout(timeout);
      worker.terminate();
      workerRef.current = null;
      setMode("edit");
      alert("Simulation failed. Please try again.");
    };

    worker.postMessage(
      {
        type: "SIMULATE",
        heightmap: heightmap.buffer,
        windDirection: Math.PI / 2,
        seaLevel: 0.15,
      },
      [heightmap.buffer.slice(0)]
    );
  };

  return (
    <button className="lock-button" onClick={handleLock}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0110 0v4" />
      </svg>
      Lock Terrain
    </button>
  );
}
