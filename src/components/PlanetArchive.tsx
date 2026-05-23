import { useHeightmapStore } from "../store/heightmap";

export default function PlanetArchive() {
  const mode = useHeightmapStore((s) => s.mode);
  const archive = useHeightmapStore((s) => s.archive);

  if (mode !== "observing" || !archive) return null;

  return (
    <div className="archive-panel">
      <h2 className="archive-title">星球档案</h2>

      <div className="archive-section">
        <h3>地形分类</h3>
        <div className="stat-row">
          <span className="stat-label">山脉</span>
          <span className="stat-value">{archive.terrain.mountainPct}%</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">高原</span>
          <span className="stat-value">{archive.terrain.plateauPct}%</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">平原</span>
          <span className="stat-value">{archive.terrain.plainPct}%</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">盆地</span>
          <span className="stat-value">{archive.terrain.basinPct}%</span>
        </div>
      </div>

      <div className="archive-section">
        <h3>气候带</h3>
        <div className="stat-row">
          <span className="stat-label">盛行风</span>
          <span className="stat-value accent">{archive.climate.prevailingWind === "Westerly" ? "西风" : archive.climate.prevailingWind}</span>
        </div>
        {archive.climate.zones.map((z) => (
          <div className="stat-row" key={z.name}>
            <span className="stat-label">{z.name === "Tropical" ? "热带" : z.name === "Temperate" ? "温带" : z.name === "Cold" ? "寒带" : z.name === "Arid" ? "干旱" : z.name}</span>
            <span className="stat-value">{z.pct}%</span>
          </div>
        ))}
      </div>

      <div className="archive-section">
        <h3>水文</h3>
        <div className="stat-row">
          <span className="stat-label">河流覆盖</span>
          <span className="stat-value">{archive.hydrology.riverCount}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">湖泊覆盖</span>
          <span className="stat-value">{archive.hydrology.lakeCount}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">流域面积</span>
          <span className="stat-value">{archive.hydrology.watershedArea}%</span>
        </div>
      </div>
    </div>
  );
}
