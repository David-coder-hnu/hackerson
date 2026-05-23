import { useHeightmapStore } from "../store/heightmap";

const LEVELS = [
  { h: 2800, color: "#5e2c14", label: "2800m" },
  { h: 2400, color: "#6b3a1f", label: "2400m" },
  { h: 2000, color: "#7d4e2a", label: "2000m" },
  { h: 1600, color: "#9b6b3d", label: "1600m" },
  { h: 1200, color: "#c9a050", label: "1200m" },
  { h: 800, color: "#9a9a42", label: "800m" },
  { h: 500, color: "#55a040", label: "500m" },
  { h: 200, color: "#e0d0a0", label: "200m" },
  { h: 0, color: "#2a8aaa", label: "0m" },
  { h: -200, color: "#1a5a9a", label: "-200m" },
  { h: -400, color: "#0a2a6a", label: "-400m" },
];

export default function HeightLegend() {
  const viewMode = useHeightmapStore((s) => s.viewMode);

  if (viewMode !== "2d") return null;

  return (
    <div className="map-legend">
      <div className="legend-header">ELEVATION</div>
      <div className="legend-gradient-wrap">
        <div className="legend-gradient">
          {LEVELS.map((lvl) => (
            <div
              key={lvl.h}
              className="legend-step"
              style={{ backgroundColor: lvl.color }}
            />
          ))}
        </div>
        <div className="legend-labels">
          {LEVELS.filter((_, i) => i % 2 === 0 || i === LEVELS.length - 1).map((lvl) => (
            <span key={lvl.h} className="legend-label">{lvl.label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// Scale bar component
export function ScaleBar() {
  const viewMode = useHeightmapStore((s) => s.viewMode);
  if (viewMode !== "2d") return null;

  return (
    <div className="scale-bar">
      <div className="scale-segments">
        <div className="scale-seg" />
        <div className="scale-seg alt" />
        <div className="scale-seg" />
        <div className="scale-seg alt" />
      </div>
      <div className="scale-label">~1000 km</div>
    </div>
  );
}
