import { useHeightmapStore } from "../store/heightmap";

const LEVELS = [
  { h: 5000, color: "#F2F2F2", label: "5000m" },
  { h: 3000, color: "#B07D62", label: "3000m" },
  { h: 1500, color: "#D9A77A", label: "1500m" },
  { h: 500, color: "#E8D89A", label: "500m" },
  { h: 200, color: "#C0D6A3", label: "200m" },
  { h: 0, color: "#9CBD7C", label: "0m" },
  { h: -200, color: "#B0D4FF", label: "-200m" },
  { h: -1000, color: "#4A7A9C", label: "-1000m" },
  { h: -3000, color: "#1A3B4C", label: "-3000m" },
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
