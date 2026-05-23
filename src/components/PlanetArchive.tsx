import { useHeightmapStore } from "../store/heightmap";

export default function PlanetArchive() {
  const mode = useHeightmapStore((s) => s.mode);
  const archive = useHeightmapStore((s) => s.archive);

  if (mode !== "observing" || !archive) return null;

  return (
    <div className="archive-panel">
      <h2 className="archive-title">Planet Archive</h2>

      <div className="archive-section">
        <h3>Terrain Classification</h3>
        <div className="stat-row">
          <span className="stat-label">Mountains</span>
          <span className="stat-value">{archive.terrain.mountainPct}%</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">Plateaus</span>
          <span className="stat-value">{archive.terrain.plateauPct}%</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">Plains</span>
          <span className="stat-value">{archive.terrain.plainPct}%</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">Basins</span>
          <span className="stat-value">{archive.terrain.basinPct}%</span>
        </div>
      </div>

      <div className="archive-section">
        <h3>Climate Zones</h3>
        <div className="stat-row">
          <span className="stat-label">Prevailing Wind</span>
          <span className="stat-value accent">{archive.climate.prevailingWind}</span>
        </div>
        {archive.climate.zones.map((z) => (
          <div className="stat-row" key={z.name}>
            <span className="stat-label">{z.name}</span>
            <span className="stat-value">{z.pct}%</span>
          </div>
        ))}
      </div>

      <div className="archive-section">
        <h3>Hydrology</h3>
        <div className="stat-row">
          <span className="stat-label">River Cells</span>
          <span className="stat-value">{archive.hydrology.riverCount}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">Lake Cells</span>
          <span className="stat-value">{archive.hydrology.lakeCount}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">Watershed</span>
          <span className="stat-value">{archive.hydrology.watershedArea}%</span>
        </div>
      </div>
    </div>
  );
}
