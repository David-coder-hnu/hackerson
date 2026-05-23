import { useHeightmapStore } from "../store/heightmap";

export default function PlanetArchive() {
  const mode = useHeightmapStore((s) => s.mode);
  const archive = useHeightmapStore((s) => s.archive);

  if (mode !== "observing" || !archive) return null;

  const { terrain, climate, hydrology, soils, plants, landArea } = archive;

  return (
    <div className="archive-panel">
      <h2 className="archive-title">星球档案</h2>

      {/* Climate */}
      <div className="archive-section">
        <h3>气候诊断</h3>
        <div className="stat-row">
          <span className="stat-label">Köppen 分类</span>
          <span className="stat-value accent">{climate.koppen.code} — {climate.koppen.name}</span>
        </div>
        <div className="koppen-desc">{climate.koppen.description}</div>
        <div className="stat-row">
          <span className="stat-label">Holdridge 生命带</span>
          <span className="stat-value">{climate.holdridge.biomeZh}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">纬度带 / 湿度</span>
          <span className="stat-value">{climate.holdridge.latBelt} · {climate.holdridge.humidity}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">生物温度 BT</span>
          <span className="stat-value">{climate.holdridge.bt}°C</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">蒸散率 PER</span>
          <span className="stat-value">{climate.holdridge.per}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">年均温 / 年降水</span>
          <span className="stat-value">{climate.avgTemp}°C / {climate.avgPrecip}mm</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">年温差 / 盛行风</span>
          <span className="stat-value">{climate.annualRange}°C / {climate.prevailingWind === "Westerly" ? "西风" : climate.prevailingWind}</span>
        </div>
      </div>

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
