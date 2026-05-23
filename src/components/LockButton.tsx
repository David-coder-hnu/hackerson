import { useHeightmapStore } from "../store/heightmap";
import { runSimulation } from "../simulation/runner";

export default function LockButton() {
  const mode = useHeightmapStore((s) => s.mode);
  const heightmap = useHeightmapStore((s) => s.heightmap);
  const markers = useHeightmapStore((s) => s.markers);
  const setMode = useHeightmapStore((s) => s.setMode);
  const setSimProgress = useHeightmapStore((s) => s.setSimProgress);
  const setArchive = useHeightmapStore((s) => s.setArchive);
  const setRiverData = useHeightmapStore((s) => s.setRiverData);
  const setPinAnalyses = useHeightmapStore((s) => s.setPinAnalyses);

  if (mode !== "edit") return null;

  const handleLock = () => {
    if (!heightmap) return;
    setMode("simulating");
    setSimProgress(null);
    setArchive(null);
    setRiverData({ riverMask: null, lakeMask: null, riverPaths: null, lakeRegions: null });

    runSimulation(heightmap, {
      pins: markers.map(m => ({ x: m.x, y: m.y })),
      onProgress: (phase, data) => {
        if (phase === "hydrology") {
          setRiverData(data as any);
          setSimProgress({ phase: "hydrology", ...data });
        } else if (phase === "climate") {
          const prev = useHeightmapStore.getState().simProgress;
          setSimProgress({
            phase: "climate",
            riverMask: prev?.riverMask,
            lakeMask: prev?.lakeMask,
            flowAccum: prev?.flowAccum,
            ...data,
          });
        }
      },
      onComplete: (archive) => {
        if (archive.pinAnalyses) setPinAnalyses(archive.pinAnalyses);
        setArchive(archive);
        setMode("observing");
      },
      onError: (err) => {
        setMode("edit");
        alert(err);
      },
    });
  };

  return (
    <button className="lock-button" onClick={handleLock}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0110 0v4" />
      </svg>
      Lock 锁定地形
    </button>
  );
}
