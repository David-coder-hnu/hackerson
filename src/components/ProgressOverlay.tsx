import { useHeightmapStore } from "../store/heightmap";

const PHASE_LABELS: Record<string, string> = {
  hydrology: "正在填充洼地...",
  climate: "正在生成河流与气候...",
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
          {simProgress ? PHASE_LABELS[simProgress.phase] ?? "正在生成气候..." : "正在初始化模拟..."}
        </div>
        <div className="progress-steps">
          <span className={`step ${simProgress ? "done" : "active"}`}>
            水文
          </span>
          <span className="step-divider">→</span>
          <span className={`step ${simProgress?.phase === "climate" ? "active" : ""}`}>
            气候
          </span>
          <span className="step-divider">→</span>
          <span className="step">完成</span>
        </div>
      </div>
    </div>
  );
}
