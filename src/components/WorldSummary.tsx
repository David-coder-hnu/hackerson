import { useHeightmapStore } from "../store/heightmap";

function generateSummary(archive: any): string {
  const { terrain, climate, hydrology, landArea } = archive;
  const parts: string[] = [];

  // Terrain
  const dominant = [
    { name: "山脉", pct: terrain.mountainPct },
    { name: "高原", pct: terrain.plateauPct },
    { name: "平原", pct: terrain.plainPct },
    { name: "盆地", pct: terrain.basinPct },
  ].sort((a, b) => b.pct - a.pct)[0];

  if (dominant.pct > 30) {
    parts.push(`以${dominant.name}为主`);
  }
  if (landArea < 30) parts.push("海洋占主导");
  else if (landArea > 70) parts.push("广阔的陆地");
  else parts.push("海陆交错");

  // Climate (from Köppen in holdridge context)
  if (climate?.holdridge?.biomeZh) {
    parts.push(`${climate.holdridge.biomeZh}气候带`);
  }

  // Hydrology
  if (hydrology) {
    if (hydrology.riverCount > 5000) parts.push("密布的河网");
    else if (hydrology.riverCount > 500) parts.push("蜿蜒的河流");
    if (hydrology.lakeCount > 1000) parts.push("星罗棋布的湖泊");
    else if (hydrology.lakeCount > 100) parts.push("散落的湖泊");
  }

  // Terrain features
  if (terrain.mountainPct > 20) parts.push("巍峨的山脉");
  if (terrain.plainPct > 30) parts.push("一望无际的平原");
  if (terrain.basinPct > 15) parts.push("深邃的盆地");

  return parts.join("，");
}

export default function WorldSummary() {
  const mode = useHeightmapStore((s) => s.mode);
  const archive = useHeightmapStore((s) => s.archive);

  if (mode !== "observing" || !archive) return null;

  const summary = generateSummary(archive);

  return (
    <div className="world-summary">
      你生成了一个{summary}的世界
    </div>
  );
}
