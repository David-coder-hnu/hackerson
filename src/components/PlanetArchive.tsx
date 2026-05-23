import { useHeightmapStore } from "../store/heightmap";

export default function PlanetArchive() {
  const mode = useHeightmapStore((s) => s.mode);
  const archive = useHeightmapStore((s) => s.archive);

  if (mode !== "observing" || !archive) return null;

  const { terrain, hydrology, soils, plants, landArea } = archive;

  return (
    <div className="archive-panel">
      <h2 className="archive-title">星球档案</h2>

      {/* Terrain */}
      <div className="archive-section">
        <h3>地形分类 · 陆地 {landArea}%</h3>
        <div className="stat-row"><span className="stat-label">山脉</span><span className="stat-value">{terrain.mountainPct}%</span></div>
        <div className="stat-row"><span className="stat-label">高原</span><span className="stat-value">{terrain.plateauPct}%</span></div>
        <div className="stat-row"><span className="stat-label">平原</span><span className="stat-value">{terrain.plainPct}%</span></div>
        <div className="stat-row"><span className="stat-label">盆地</span><span className="stat-value">{terrain.basinPct}%</span></div>
      </div>

      {/* Hydrology */}
      <div className="archive-section">
        <h3>水文</h3>
        <div className="stat-row"><span className="stat-label">河流格点数</span><span className="stat-value">{hydrology.riverCount}</span></div>
        <div className="stat-row"><span className="stat-label">湖泊格点数</span><span className="stat-value">{hydrology.lakeCount}</span></div>
        <div className="stat-row"><span className="stat-label">流域覆盖率</span><span className="stat-value">{hydrology.watershedArea}%</span></div>
      </div>

      {/* Soil */}
      {soils.length > 0 && (
        <div className="archive-section">
          <h3>土壤类型 (WRB)</h3>
          {soils.map((s, i) => (
            <div key={i} className="soil-row">
              <span className="soil-name">{s.name} <em>({s.wrb})</em></span>
              <span className="soil-conf">[{s.confidence}]</span>
              <span className="soil-note">{s.note}</span>
            </div>
          ))}
        </div>
      )}

      {/* Plants */}
      {plants.length > 0 && (
        <div className="archive-section">
          <h3>原生植被与作物</h3>
          {plants.map((p, i) => (
            <div key={i} className="plant-group">
              <div className="plant-habitat">{p.habitat} — {p.description}</div>
              <div className="plant-species">
                {p.species.map((sp, j) => (
                  <span key={j} className="plant-tag" title={`用途: ${sp.uses}`}>
                    {sp.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
