import { useState } from "react";
import { useHeightmapStore } from "../store/heightmap";

export function CustomPinInput({ x, y, onDone }: { x: number; y: number; onDone: () => void }) {
  const addCustomPin = useHeightmapStore((s) => s.addCustomPin);
  const [text, setText] = useState("");

  const handleSubmit = () => {
    if (text.trim()) {
      addCustomPin(x, y, text.trim());
      setText("");
      onDone();
    }
  };

  return (
    <div className="worldbuild-input">
      <input
        className="worldbuild-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); if (e.key === "Escape") onDone(); }}
        placeholder="输入图钉内容..."
        autoFocus
      />
      <button className="worldbuild-btn" onClick={handleSubmit}>放置</button>
      <button className="worldbuild-btn cancel" onClick={onDone}>取消</button>
    </div>
  );
}

export function RegionNameInput({ onDone }: { onDone: (name: string | null) => void }) {
  const [text, setText] = useState("");

  const handleSubmit = () => {
    if (text.trim()) {
      onDone(text.trim());
      setText("");
    }
  };

  return (
    <div className="worldbuild-input">
      <input
        className="worldbuild-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); if (e.key === "Escape") onDone(null); }}
        placeholder="输入选区名称..."
        autoFocus
      />
      <button className="worldbuild-btn" onClick={handleSubmit}>命名</button>
      <button className="worldbuild-btn cancel" onClick={() => onDone(null)}>取消</button>
    </div>
  );
}
