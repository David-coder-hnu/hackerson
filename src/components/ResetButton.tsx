import { useHeightmapStore } from "../store/heightmap";

export default function ResetButton() {
  const mode = useHeightmapStore((s) => s.mode);
  const reset = useHeightmapStore((s) => s.reset);

  if (mode === "simulating") return null;

  return (
    <button className="reset-button" onClick={reset}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0118.8-4.3M22 12.5a10 10 0 01-18.8 4.2" />
      </svg>
      新星球
    </button>
  );
}
