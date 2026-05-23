import { useHeightmapStore } from "../store/heightmap";

export default function StatusBar() {
  const mouseHeight = useHeightmapStore((s) => s.mouseHeight);
  const mouseBiome = useHeightmapStore((s) => s.mouseBiome);

  return (
    <div className="status-bar">
      <span>高度: {mouseHeight}m</span>
      <span className="status-sep">|</span>
      <span>{mouseBiome}</span>
    </div>
  );
}
