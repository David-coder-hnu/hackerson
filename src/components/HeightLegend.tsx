import { useHeightmapStore } from "../store/heightmap";

const LEVELS = [
  { h: 8000, color: "#FFFFFF", label: "8000m" },
  { h: 5000, color: "#D9D9D9", label: "5000m" },
  { h: 3500, color: "#B0A098", label: "3500m" },
  { h: 2500, color: "#C9A06A", label: "2500m" },
  { h: 1500, color: "#E5C27E", label: "1500m" },
  { h: 1000, color: "#D2DF9E", label: "1000m" },
  { h: 500, color: "#AAD1AA", label: "500m" },
  { h: 200, color: "#7CB15E", label: "200m" },
  { h: 0, color: "#4C8C3A", label: "0m" },
  { h: -50, color: "#A8D8FF", label: "-50m" },
  { h: -200, color: "#6BB5FF", label: "-200m" },
  { h: -1000, color: "#3A85CC", label: "-1000m" },
  { h: -3000, color: "#1A5C99", label: "-3000m" },
  { h: -6000, color: "#0D3B66", label: "-6000m" },
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
