import { useHeightmapStore } from "../store/heightmap";
import { getShareUrl } from "../share/urlCodec";
import { useState } from "react";

export default function ShareButton() {
  const mode = useHeightmapStore((s) => s.mode);
  const heightmap = useHeightmapStore((s) => s.heightmap);
  const [copied, setCopied] = useState(false);

  if (mode !== "observing" || !heightmap) return null;

  const handleShare = () => {
    const url = getShareUrl(heightmap);
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button className="share-button" onClick={handleShare}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
      </svg>
      {copied ? "Copied!" : "Share Planet"}
    </button>
  );
}
