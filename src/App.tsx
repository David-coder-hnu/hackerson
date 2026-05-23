import { useEffect } from "react";
import { useHeightmapStore } from "./store/heightmap";
import { createDefaultHeightmap } from "./presets/generate";
import { decodeHeightmap, getHashFromUrl } from "./share/urlCodec";
import Scene from "./components/Scene";
import BottomToolbar from "./components/BottomToolbar";
import FloatingPanel from "./components/FloatingPanel";
import StatusBar from "./components/StatusBar";
import HeightLegend, { ScaleBar } from "./components/HeightLegend";
import LockButton from "./components/LockButton";
import ProgressOverlay from "./components/ProgressOverlay";
import PlanetArchive from "./components/PlanetArchive";
import ShareButton from "./components/ShareButton";
import ResetButton from "./components/ResetButton";
import "./App.css";

export default function App() {
  const initHeightmap = useHeightmapStore((s) => s.initHeightmap);
  const heightmap = useHeightmapStore((s) => s.heightmap);
  const mode = useHeightmapStore((s) => s.mode);

  useEffect(() => {
    const hash = getHashFromUrl();
    if (hash) {
      const decoded = decodeHeightmap(hash);
      if (decoded) { initHeightmap(decoded); return; }
    }
    initHeightmap(createDefaultHeightmap());
  }, [initHeightmap]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) useHeightmapStore.getState().redo();
        else useHeightmapStore.getState().undo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!heightmap) {
    return (
      <div className="loading-screen">
        <h1 className="loading-title">TerraDiagnosis</h1>
        <p className="loading-subtitle">地脉·镜</p>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1 className="app-title">TerraDiagnosis</h1>
          <span className="app-subtitle">地脉·镜</span>
        </div>
        <div className="header-right">
          <PresetButtons />
          <ResetButton />
        </div>
      </header>

      <Scene />

      {/* Top-left compass */}
      <div className="compass" title="North">
        <svg width="32" height="32" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="14" fill="none" stroke="#c9a050" strokeWidth="1.5" />
          <path d="M16 2l4 14-4 14-4-14z" fill="#c9a050" opacity="0.8" />
          <path d="M16 2l-4 14 4 14 4-14z" fill="#8a7030" opacity="0.5" />
          <circle cx="16" cy="16" r="2" fill="#1a1816" />
        </svg>
      </div>

      {/* Bottom-right edit pencil (edit mode indicator) */}
      {mode === "edit" && (
        <div className="edit-indicator" title="Edit Mode">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e8945a" strokeWidth="2">
            <path d="M17 3a2.83 2.83 0 014 4L7.5 20.5 2 22l1.5-5.5z" />
            <path d="M15 5l4 4" />
          </svg>
        </div>
      )}

      <FloatingPanel />
      <StatusBar />
      <HeightLegend />
      <ScaleBar />
      <BottomToolbar />

      {mode === "edit" && (
        <div className="empty-hint">
          推这片土地，创造你的世界
        </div>
      )}

      <LockButton />
      <ProgressOverlay />

      {mode === "observing" && (
        <>
          <PlanetArchive />
          <ShareButton />
        </>
      )}
    </div>
  );
}

function PresetButtons() {
  const initHeightmap = useHeightmapStore((s) => s.initHeightmap);
  const mode = useHeightmapStore((s) => s.mode);
  if (mode !== "edit") return null;

  const presets = [
    { key: "earthlike" as const, label: "类地大陆" },
    { key: "subduction" as const, label: "岛弧" },
    { key: "rift" as const, label: "裂谷" },
    { key: "pangaea" as const, label: "盘古" },
  ];

  const handlePreset = async (key: typeof presets[0]["key"]) => {
    const { generatePreset } = await import("./presets/generate");
    initHeightmap(generatePreset(key));
  };

  return (
    <div className="preset-bar">
      {presets.map(({ key, label }) => (
        <button key={key} className="preset-btn" onClick={() => handlePreset(key)}>
          {label}
        </button>
      ))}
    </div>
  );
}
