import { useHeightmapStore } from "../store/heightmap";

const PHASE_LABELS: Record<string, string> = {
  hydrology: "填充洼地 · 计算流向 · 追踪河流",
  climate: "纬度温度 · 地形降水 · 气候分类",
};

const STEP_ORDER = ["hydrology", "climate", "complete"] as const;

export default function ProgressOverlay() {
  const mode = useHeightmapStore((s) => s.mode);
  const simProgress = useHeightmapStore((s) => s.simProgress);

  if (mode !== "simulating") return null;

  const currentIdx = simProgress
    ? STEP_ORDER.indexOf(simProgress.phase as typeof STEP_ORDER[number])
    : -1;

  return (
    <div className="progress-overlay">
      <div className="progress-card">
        <div className="spinner" />
        <div className="progress-text">
          {simProgress ? PHASE_LABELS[simProgress.phase] ?? "正在生成气候..." : "初始化模拟引擎..."}
        </div>
        <div className="progress-steps">
          {STEP_ORDER.map((step, i) => (
            <>
              {i > 0 && (
                <span className={`step-divider ${i <= currentIdx ? "done" : ""}`}>→</span>
              )}
              <span className={`step ${i < currentIdx ? "done" : i === currentIdx ? "active" : ""}`}>
                {step === "hydrology" ? "水文" : step === "climate" ? "气候" : "完成"}
              </span>
            </>
          ))}
        </div>
      </div>
    </div>
  );
}
