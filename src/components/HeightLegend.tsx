import { useHeightmapStore } from "../store/heightmap";

const LEVELS = [
  { h: 2500, color: "#5e2c14", label: "2500m" },
  { h: 2200, color: "#6b3a1f", label: "2200m" },
  { h: 1900, color: "#7d4e2a", label: "1900m" },
  { h: 1600, color: "#9b6b3d", label: "1600m" },
  { h: 1300, color: "#b8844a", label: "1300m" },
  { h: 1000, color: "#c9a050", label: "1000m" },
  { h: 700, color: "#b5b840", label: "700m" },
  { h: 400, color: "#7fa83e", label: "400m" },
  { h: 100, color: "#4d9230", label: "100m" },
  { h: 0, color: "#2a7a7a", label: "Sub-sea" },
];

export default function HeightLegend() {
  const viewMode = useHeightmapStore((s) => s.viewMode);
  const mode = useHeightmapStore((s) => s.mode);

  if (mode === "edit" || viewMode !== "2d") return null;

  return (
    <div className="height-legend">
      <div className="legend-title">高程</div>
      <div className="legend-gradient">
        {LEVELS.map((lvl) => (
          <div
            key={lvl.h}
            className="legend-step"
            style={{ backgroundColor: lvl.color }}
            title={lvl.label}
          />
        ))}
      </div>
      <div className="legend-labels">
        {LEVELS.filter((_, i) => i % 2 === 0).map((lvl) => (
          <span key={lvl.h} className="legend-label">{lvl.label}</span>
        ))}
      </div>
    </div>
  );
}
