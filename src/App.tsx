import { useEffect, useState, useCallback } from "react";
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
import PinCard from "./components/PinCard";
import { CustomPinInput, RegionNameInput } from "./components/WorldbuildTools";
import WorldSummary from "./components/WorldSummary";
import "./App.css";

function isTerrainFresh(hm: Float32Array | null): boolean {
  if (!hm) return true;
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < hm.length; i++) {
    if (hm[i] < min) min = hm[i];
    if (hm[i] > max) max = hm[i];
  }
  return max - min < 0.01;
}

export default function App() {
  const initHeightmap = useHeightmapStore((s) => s.initHeightmap);
  const heightmap = useHeightmapStore((s) => s.heightmap);
  const mode = useHeightmapStore((s) => s.mode);
  const markers = useHeightmapStore((s) => s.markers);
  const activeTool = useHeightmapStore((s) => s.activeTool);
  const [hoveredPin, setHoveredPin] = useState<number | null>(null);
  const [hoveredCustomPin, setHoveredCustomPin] = useState<string | null>(null);
  const customPins = useHeightmapStore((s) => s.customPins);
  const [pendingPin, setPendingPin] = useState<{x:number;y:number} | null>(null);
  const [pendingRegionPoints, setPendingRegionPoints] = useState<Array<{x:number;y:number}>>([]);
  const [pendingRegionName, setPendingRegionName] = useState(false);
  const webglLost = useHeightmapStore((s) => s.webglLost);
  const [notification, setNotification] = useState<{ message: string; type: "info" | "error" } | null>(null);

  const showNotification = useCallback((message: string, type: "info" | "error" = "error") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  const handlePinHover = useCallback((i: number | null) => {
    setHoveredPin(i);
  }, []);

  const handleCustomClick = useCallback((x: number, y: number) => {
    if (activeTool === "pin") {
      setPendingPin({ x, y });
    } else if (activeTool === "region") {
      setPendingRegionPoints((pts) => [...pts, { x, y }]);
    }
  }, [activeTool]);

  const handleCustomPinHover = useCallback((id: string | null) => {
    setHoveredCustomPin(id);
  }, []);

  const handleRegionDone = useCallback((name: string | null) => {
    if (name && pendingRegionPoints.length > 2) {
      const store = useHeightmapStore.getState();
      store.addCustomRegion(pendingRegionPoints, name);
    }
    setPendingRegionPoints([]);
    setPendingRegionName(false);
  }, [pendingRegionPoints]);

  useEffect(() => {
    const hash = getHashFromUrl();
    if (hash) {
      const decoded = decodeHeightmap(hash);
      if (decoded) { initHeightmap(decoded); return; }
      showNotification("分享链接已失效，加载默认地形", "info");
    }
    initHeightmap(createDefaultHeightmap());
  }, [initHeightmap, showNotification]);

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

      <Scene onPinHover={handlePinHover} onCustomClick={handleCustomClick} onCustomPinHover={handleCustomPinHover} />
      <WorldSummary />

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
          <div>左键拖动: 雕刻地形 &nbsp;|&nbsp; 右键拖动: 旋转 &nbsp;|&nbsp; 中键拖动: 平移 &nbsp;|&nbsp; 滚轮: 缩放</div>
          <div>键盘 WASD: 平移 &nbsp;|&nbsp; Q/E: 旋转</div>
        </div>
      )}

      <LockButton />
      <ProgressOverlay />

      {/* WebGL context lost overlay */}
      {webglLost && (
        <div className="webgl-lost-overlay">
          <div className="webgl-lost-card">
            <div className="spinner" />
            <p>渲染引擎重启中...</p>
          </div>
        </div>
      )}

      {mode === "observing" && (
        <>
          <PlanetArchive />
          <ShareButton />
        </>
      )}
      {hoveredPin !== null && markers[hoveredPin]?.analysis && (
        <PinCard analysis={markers[hoveredPin].analysis!} pos={{ x: 60, y: 120 }} />
      )}
      {hoveredCustomPin && customPins.find(cp => cp.id === hoveredCustomPin) && (
        <div className="custompin-card">
          {customPins.find(cp => cp.id === hoveredCustomPin)!.content}
        </div>
      )}
      {pendingPin && (
        <CustomPinInput x={pendingPin.x} y={pendingPin.y} onDone={() => setPendingPin(null)} />
      )}
      {pendingRegionName && (
        <RegionNameInput onDone={handleRegionDone} />
      )}
      {mode === "observing" && activeTool === "region" && pendingRegionPoints.length > 0 && (
        <div className="region-controls">
          <span>{pendingRegionPoints.length} 个顶点</span>
          <button className="worldbuild-btn" onClick={() => setPendingRegionName(true)}>完成选区</button>
          <button className="worldbuild-btn cancel" onClick={() => setPendingRegionPoints([])}>取消</button>
        </div>
      )}

      {/* Onboarding card for fresh terrain */}
      {mode === "edit" && isTerrainFresh(heightmap) && (
        <div className="onboarding-card">
          <div className="onboarding-title">创建你的星球</div>
          <div className="onboarding-steps">
            <span className="onboarding-step">1. 选择一个预设（上方按钮）或直接推拉地形</span>
            <span className="onboarding-step">2. 左键拖动雕刻地形 · 右键旋转 · 滚轮缩放</span>
            <span className="onboarding-step">3. 点击右下角「Lock 锁定地形」启动地理模拟</span>
          </div>
        </div>
      )}

      {/* Notification toast */}
      {notification && (
        <div className={`notification-toast ${notification.type}`}>
          {notification.message}
        </div>
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
