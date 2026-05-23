import { useHeightmapStore } from "../store/heightmap";

export default function FloatingPanel() {
  const brush = useHeightmapStore((s) => s.brush);
  const setBrush = useHeightmapStore((s) => s.setBrush);
  const mode = useHeightmapStore((s) => s.mode);

  if (mode !== "edit") return null;

  return (
    <div className="floating-panel">
      <div className="fp-section">
        <div className="fp-label">半径: 3-100</div>
        <div className="fp-slider-wrap">
          <input
            type="range"
            min={3}
            max={100}
            value={brush.radius}
            onChange={(e) => setBrush({ radius: Number(e.target.value) })}
            className="fp-slider fp-slider-vertical"
            style={{ writingMode: "vertical-lr", direction: "rtl", height: 80 }}
          />
          <span className="fp-value">{brush.radius}px</span>
        </div>
      </div>
      <div className="fp-section">
        <div className="fp-label">强度</div>
        <div className="fp-slider-wrap">
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={Math.round(brush.strength * 100)}
            onChange={(e) => setBrush({ strength: Number(e.target.value) / 100 })}
            className="fp-slider fp-slider-vertical"
            style={{ writingMode: "vertical-lr", direction: "rtl", height: 80 }}
          />
          <span className="fp-value">{Math.round(brush.strength * 100)}</span>
        </div>
      </div>
    </div>
  );
}
