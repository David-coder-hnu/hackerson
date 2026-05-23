import { useHeightmapStore } from "../store/heightmap";
import type { BrushType } from "../types";

const BRUSH_TYPES: { type: BrushType; label: string; icon: string }[] = [
  { type: "raise", label: "Raise", icon: "M4 20 L12 8 L20 20" },
  { type: "lower", label: "Lower", icon: "M4 8 L12 20 L20 8" },
  { type: "flatten", label: "Flatten", icon: "M4 14 L20 14" },
  { type: "smooth", label: "Smooth", icon: "M4 12 Q8 6 12 12 Q16 18 20 12" },
];

export default function BrushToolbar() {
  const brush = useHeightmapStore((s) => s.brush);
  const setBrush = useHeightmapStore((s) => s.setBrush);
  const mode = useHeightmapStore((s) => s.mode);
  const undo = useHeightmapStore((s) => s.undo);
  const redo = useHeightmapStore((s) => s.redo);
  const undoStack = useHeightmapStore((s) => s.undoStack);
  const redoStack = useHeightmapStore((s) => s.redoStack);

  if (mode !== "edit") return null;

  return (
    <div className="brush-toolbar">
      <div className="toolbar-section">
        <div className="section-label">Brush</div>
        <div className="brush-types">
          {BRUSH_TYPES.map(({ type, label, icon }) => (
            <button
              key={type}
              className={`brush-btn ${brush.type === type ? "active" : ""}`}
              onClick={() => setBrush({ type })}
              title={label}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d={icon} />
              </svg>
            </button>
          ))}
        </div>
      </div>

      <div className="toolbar-section">
        <div className="section-label">
          Radius: <span className="value">{brush.radius}</span>
        </div>
        <input
          type="range"
          min={3}
          max={60}
          value={brush.radius}
          onChange={(e) => setBrush({ radius: Number(e.target.value) })}
          className="slider"
        />
      </div>

      <div className="toolbar-section">
        <div className="section-label">
          Strength: <span className="value">{(brush.strength * 100).toFixed(0)}%</span>
        </div>
        <input
          type="range"
          min={0.05}
          max={1}
          step={0.05}
          value={brush.strength}
          onChange={(e) => setBrush({ strength: Number(e.target.value) })}
          className="slider"
        />
      </div>

      <div className="toolbar-section">
        <div className="undo-redo">
          <button
            className="icon-btn"
            disabled={undoStack.length === 0}
            onClick={undo}
            title="Undo (Ctrl+Z)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4" />
            </svg>
          </button>
          <button
            className="icon-btn"
            disabled={redoStack.length === 0}
            onClick={redo}
            title="Redo (Ctrl+Y)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10H11a5 5 0 00-5 5v2M21 10l-4-4M21 10l-4 4" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
