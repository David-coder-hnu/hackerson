import { useHeightmapStore } from "../store/heightmap";

const PHASE_LABELS: Record<string, string> = {
  hydrology: "Filling depressions...",
  climate: "Computing rivers & lakes...",
};

export default function ProgressOverlay() {
  const mode = useHeightmapStore((s) => s.mode);
  const simProgress = useHeightmapStore((s) => s.simProgress);

  if (mode !== "simulating") return null;

  return (
    <div className="progress-overlay">
      <div className="progress-card">
        <div className="spinner" />
        <div className="progress-text">
          {simProgress ? PHASE_LABELS[simProgress.phase] ?? "Generating climate..." : "Initializing simulation..."}
        </div>
        <div className="progress-steps">
          <span className={`step ${simProgress ? "done" : "active"}`}>
            Hydrology
          </span>
          <span className="step-divider">→</span>
          <span className={`step ${simProgress?.phase === "climate" ? "active" : ""}`}>
            Climate
          </span>
          <span className="step-divider">→</span>
          <span className="step">Complete</span>
        </div>
      </div>
    </div>
  );
}
