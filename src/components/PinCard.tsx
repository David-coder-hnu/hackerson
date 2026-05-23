import type { PinAnalysis } from "../types";

export default function PinCard({ analysis, pos }: { analysis: PinAnalysis; pos: { x: number; y: number } }) {
  if (!analysis) return null;

  return (
    <div className="pin-card" style={{ left: pos.x, top: pos.y }}>
      <div className="pin-card-title">
        {analysis.lat >= 0 ? "N" : "S"}{Math.abs(analysis.lat).toFixed(1)}°{" "}
        {analysis.lon >= 0 ? "E" : "W"}{Math.abs(analysis.lon).toFixed(1)}°
      </div>

      <div className="pin-section">
        <div className="pin-row"><span>海拔</span><span>{analysis.elevation}m</span></div>
        <div className="pin-row"><span>坡度</span><span>{analysis.slope}° {analysis.aspect}坡</span></div>
        <div className="pin-row"><span>距海岸</span><span>{analysis.coastDist}km</span></div>
        <div className="pin-row"><span>气压带</span><span className="accent">{analysis.pressureBelt}</span></div>
      </div>

      <div className="pin-section">
        <div className="pin-kop">{analysis.koppen}</div>
        <div className="pin-biome">{analysis.holdridge}</div>
        <div className="pin-desc">{analysis.description}</div>
      </div>

      <div className="pin-section">
        <div className="pin-row"><span>年均温</span><span>{analysis.tempAnnual}°C</span></div>
        <div className="pin-row"><span>年降水</span><span>{analysis.precipAnnual}mm</span></div>
        <div className="pin-row"><span>土壤</span><span>{analysis.soil}</span></div>
      </div>

      {analysis.plants.length > 0 && (
        <div className="pin-section">
          <div className="pin-label">原生植物</div>
          <div className="pin-tags">{analysis.plants.join(" · ")}</div>
        </div>
      )}

      {analysis.crops.length > 0 && (
        <div className="pin-section">
          <div className="pin-label">适宜作物</div>
          <div className="pin-tags">{analysis.crops.join(" · ")}</div>
        </div>
      )}
    </div>
  );
}
