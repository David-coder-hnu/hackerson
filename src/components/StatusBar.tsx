import { useHeightmapStore } from "../store/heightmap";

function formatLat(lat: number): string {
  const abs = Math.abs(lat).toFixed(1);
  return lat >= 0 ? `${abs}°N` : `${abs}°S`;
}

function formatLon(lon: number): string {
  const abs = Math.abs(lon).toFixed(1);
  return lon >= 0 ? `${abs}°E` : `${abs}°W`;
}

export default function StatusBar() {
  const mouseHeight = useHeightmapStore((s) => s.mouseHeight);
  const mouseBiome = useHeightmapStore((s) => s.mouseBiome);
  const mouseLat = useHeightmapStore((s) => s.mouseLat);
  const mouseLon = useHeightmapStore((s) => s.mouseLon);

  return (
    <div className="status-bar">
      <span>{formatLat(mouseLat)} {formatLon(mouseLon)}</span>
      <span className="status-sep">|</span>
      <span>高度: {mouseHeight}m</span>
      <span className="status-sep">|</span>
      <span>{mouseBiome}</span>
    </div>
  );
}
