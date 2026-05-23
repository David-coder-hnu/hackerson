import { useHeightmapStore } from "../store/heightmap";
import type { BrushType } from "../types";
import { generatePreset } from "../presets/generate";
import { runSimulation } from "../simulation/runner";

interface ToolDef {
  key: string;
  label: string;
  icon: string;
  type: BrushType | "random" | "rivers" | "diagnosis" | "toggle" | "reset";
}

const TOOLS: ToolDef[] = [
  { key: "camera", label: "视角", icon: "camera", type: "camera" },
  { key: "raise", label: "隆起", icon: "raise", type: "raise" },
  { key: "lower", label: "削低", icon: "lower", type: "lower" },
  { key: "smooth", label: "平滑", icon: "smooth", type: "smooth" },
  { key: "water", label: "绘水", icon: "water", type: "water" },
  { key: "marker", label: "标记", icon: "marker", type: "marker" },
  { key: "random", label: "随机", icon: "random", type: "random" },
  { key: "rivers", label: "生成河流", icon: "rivers", type: "rivers" },
  { key: "diagnosis", label: "生态诊断", icon: "diagnosis", type: "diagnosis" },
  { key: "toggle", label: "2D/3D", icon: "toggle", type: "toggle" },
  { key: "reset", label: "重置", icon: "reset", type: "reset" },
];

function ToolIcon({ icon, active }: { icon: string; active: boolean }) {
  const color = active ? "#e8945a" : "currentColor";
  switch (icon) {
    case "camera":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2" strokeWidth="1.5" />
        </svg>
      );
    case "raise":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <path d="M12 3L4 21h16L12 3z" />
          <path d="M12 3v10" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case "lower":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <path d="M12 21L4 3h16L12 21z" />
          <path d="M12 21v-10" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case "smooth":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <path d="M3 12c2-6 6-6 9 0s6 6 9 0" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "water":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <path d="M12 3c-3 4-6 8-6 12a6 6 0 0012 0c0-4-3-8-6-12z" />
          <path d="M9 15a3 3 0 006 0" strokeWidth="1.5" />
        </svg>
      );
    case "marker":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z" />
          <circle cx="12" cy="9" r="2" fill={color} />
        </svg>
      );
    case "random":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <text x="12" y="17" textAnchor="middle" fontSize="14" fill={color} stroke="none">?</text>
        </svg>
      );
    case "rivers":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <path d="M3 18c4-4 4 4 8 0s4-4 8 0" strokeWidth="1.5" />
          <path d="M5 12c3-3 3 3 6 0s3-3 6 0" strokeWidth="1.5" />
        </svg>
      );
    case "diagnosis":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
        </svg>
      );
    case "toggle":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <rect x="2" y="2" width="20" height="20" rx="2" />
          <path d="M2 7h20M2 12h20M2 17h20" strokeWidth="0.5" opacity="0.5" />
          <path d="M7 2v20" strokeWidth="0.5" opacity="0.5" />
        </svg>
      );
    case "reset":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0118.8-4.3M22 12.5a10 10 0 01-18.8 4.2" />
        </svg>
      );
    default:
      return <circle cx="12" cy="12" r="8" fill={color} />;
  }
}

export default function BottomToolbar() {
  const brush = useHeightmapStore((s) => s.brush);
  const setBrush = useHeightmapStore((s) => s.setBrush);
  const viewMode = useHeightmapStore((s) => s.viewMode);
  const setViewMode = useHeightmapStore((s) => s.setViewMode);
  const heightmap = useHeightmapStore((s) => s.heightmap);
  const initHeightmap = useHeightmapStore((s) => s.initHeightmap);
  const reset = useHeightmapStore((s) => s.reset);
  const setMode = useHeightmapStore((s) => s.setMode);
  const setSimProgress = useHeightmapStore((s) => s.setSimProgress);
  const setArchive = useHeightmapStore((s) => s.setArchive);
  const setRiverData = useHeightmapStore((s) => s.setRiverData);

  const handleToolClick = (tool: ToolDef) => {
    switch (tool.type) {
      case "camera":
      case "raise":
      case "lower":
      case "smooth":
      case "water":
        setBrush({ type: tool.type });
        break;
      case "marker":
        setBrush({ type: "marker" });
        break;
      case "random": {
        const presets = ["volcanic-island", "mountain-chain", "crater-lake", "archipelago"] as const;
        const key = presets[Math.floor(Math.random() * presets.length)];
        initHeightmap(generatePreset(key));
        break;
      }
      case "rivers":
        if (!heightmap) return;
        setMode("simulating");
        setSimProgress(null);
        setRiverData({ riverMask: null, lakeMask: null });
        runSimulation(heightmap, {
          onProgress: (phase, data) => {
            if (phase === "hydrology") {
              setRiverData(data);
              setSimProgress({ phase: "hydrology", ...data });
            }
          },
          onComplete: () => {
            setMode("edit");
            setSimProgress(null);
          },
          onError: (err) => {
            setMode("edit");
            alert(err);
          },
        });
        break;
      case "diagnosis":
        if (!heightmap) return;
        setMode("simulating");
        setSimProgress(null);
        runSimulation(heightmap, {
          onProgress: (phase, data) => {
            if (phase === "hydrology") {
              setRiverData(data);
              setSimProgress({ phase: "hydrology", ...data });
            } else if (phase === "climate") {
              setSimProgress({ phase: "climate", ...data });
            }
          },
          onComplete: (archive) => {
            setArchive(archive);
            setMode("observing");
            setSimProgress(null);
          },
          onError: (err) => {
            setMode("edit");
            alert(err);
          },
        });
        break;
      case "toggle":
        setViewMode(viewMode === "3d" ? "2d" : "3d");
        break;
      case "reset":
        reset();
        break;
    }
  };

  const isActive = (tool: ToolDef) => {
    if (tool.type === "toggle") return viewMode === "2d";
    if (tool.type === "camera" || tool.type === "raise" || tool.type === "lower" || tool.type === "smooth" || tool.type === "water" || tool.type === "marker") {
      return brush.type === tool.type;
    }
    return false;
  };

  return (
    <div className="bottom-toolbar">
      {TOOLS.map((tool) => (
        <button
          key={tool.key}
          className={`tool-btn ${isActive(tool) ? "active" : ""}`}
          onClick={() => handleToolClick(tool)}
          title={tool.label}
        >
          <ToolIcon icon={tool.icon} active={isActive(tool)} />
          <span className="tool-label">{tool.label}</span>
        </button>
      ))}
    </div>
  );
}
