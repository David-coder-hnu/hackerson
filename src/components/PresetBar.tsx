import { PRESETS, generatePreset, type PresetName } from "../presets/generate";
import { useHeightmapStore } from "../store/heightmap";

export default function PresetBar() {
  const mode = useHeightmapStore((s) => s.mode);
  const initHeightmap = useHeightmapStore((s) => s.initHeightmap);

  if (mode !== "edit") return null;

  const handlePreset = (key: PresetName) => {
    const hm = generatePreset(key);
    initHeightmap(hm);
  };

  return (
    <div className="preset-bar">
      {PRESETS.map(({ name, key }) => (
        <button
          key={key}
          className="preset-btn"
          onClick={() => handlePreset(key)}
        >
          {name}
        </button>
      ))}
    </div>
  );
}
