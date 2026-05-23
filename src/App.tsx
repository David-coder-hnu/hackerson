import { useEffect } from "react";
import { useHeightmapStore } from "./store/heightmap";
import { createDefaultHeightmap } from "./presets/generate";
import { decodeHeightmap, getHashFromUrl } from "./share/urlCodec";
import Scene from "./components/Scene";
import BrushToolbar from "./components/BrushToolbar";
import PresetBar from "./components/PresetBar";
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
      if (decoded) {
        initHeightmap(decoded);
        return;
      }
    }
    initHeightmap(createDefaultHeightmap());
  }, [initHeightmap]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          useHeightmapStore.getState().redo();
        } else {
          useHeightmapStore.getState().undo();
        }
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
        <h1 className="app-title">TerraDiagnosis</h1>
        <span className="app-subtitle">地脉·镜</span>
        <div className="header-right">
          <ResetButton />
          <PresetBar />
        </div>
      </header>

      <Scene />

      <BrushToolbar />

      {mode === "edit" && (
        <div className="empty-hint">
          Push the land. Shape your world.
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
