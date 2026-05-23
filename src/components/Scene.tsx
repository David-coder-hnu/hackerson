import React, { useRef, useCallback, useEffect } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useHeightmapStore } from "../store/heightmap";
import { createTerrainMaterial, setClimateTextures } from "../render/TerrainMaterial";
import { HEIGHTMAP_SIZE } from "../types";
import { cellLat, cellLon } from "../simulation/geo";

function biomeAtHeight(h: number): string {
  if (h < 0.1) return "海洋";
  if (h < 0.18) return "海岸";
  if (h < 0.3) return "草原";
  if (h < 0.45) return "温带森林";
  if (h < 0.6) return "高地";
  if (h < 0.8) return "高山";
  return "雪顶";
}

function TerrainMesh() {
  const meshRef = useRef<THREE.Mesh>(null!);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const textureRef = useRef<THREE.DataTexture | null>(null);
  const heightmap = useHeightmapStore((s) => s.heightmap);
  const mode = useHeightmapStore((s) => s.mode);
  const viewMode = useHeightmapStore((s) => s.viewMode);
  const brush = useHeightmapStore((s) => s.brush);
  const applyBrush = useHeightmapStore((s) => s.applyBrush);
  const setMouseInfo = useHeightmapStore((s) => s.setMouseInfo);
  const addMarker = useHeightmapStore((s) => s.addMarker);
  const simProgress = useHeightmapStore((s) => s.simProgress);
  const { camera, raycaster } = useThree();
  const isDragging = useRef(false);
  const lastCell = useRef<{ x: number; y: number } | null>(null);
  const strokeCells = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!heightmap) return;
    const { material, texture } = createTerrainMaterial(heightmap);
    materialRef.current = material;
    textureRef.current = texture;
    if (meshRef.current) meshRef.current.material = material;
    return () => {
      material.dispose();
      texture.dispose();
    };
  }, []);

  useEffect(() => {
    if (!heightmap || !materialRef.current) return;
    const tex = materialRef.current.uniforms.uHeightmap.value as THREE.DataTexture;
    if (tex) { tex.image.data = heightmap; tex.needsUpdate = true; }
    materialRef.current.uniforms.uViewMode.value = viewMode === "2d" ? 1 : 0;
  }, [heightmap, viewMode]);

  // Animate climate blend transition
  useFrame((_, delta) => {
    if (!materialRef.current) return;
    const target = (simProgress?.precipMap && simProgress?.tempMap) ? 1 : 0;
    const current = materialRef.current.uniforms.uClimateBlend.value as number;
    const next = current + (target - current) * Math.min(delta * 3, 1);
    materialRef.current.uniforms.uClimateBlend.value = next;
  });

  // Update climate textures on terrain when simulation provides them
  useEffect(() => {
    if (!materialRef.current) return;
    if (simProgress?.precipMap && simProgress?.tempMap) {
      setClimateTextures(materialRef.current, simProgress.precipMap, simProgress.tempMap);
    }
    if (mode === "observing" || mode === "simulating") {
      const sp = useHeightmapStore.getState().simProgress;
      if (sp?.precipMap && sp?.tempMap) {
        setClimateTextures(materialRef.current, sp.precipMap, sp.tempMap);
      }
    }
  }, [simProgress?.precipMap, simProgress?.tempMap, mode]);

  const getUVFromEvent = useCallback((e: ThreeEvent<PointerEvent>): { x: number; y: number } | null => {
    if (!meshRef.current) return null;
    const evt = e as unknown as PointerEvent;
    raycaster.setFromCamera(
      new THREE.Vector2(
        (evt.clientX / window.innerWidth) * 2 - 1,
        -(evt.clientY / window.innerHeight) * 2 + 1
      ),
      camera
    );
    const hits = raycaster.intersectObject(meshRef.current);
    if (hits.length > 0 && hits[0].uv) {
      return {
        x: Math.floor(hits[0].uv.x * HEIGHTMAP_SIZE),
        y: Math.floor(hits[0].uv.y * HEIGHTMAP_SIZE),
      };
    }
    return null;
  }, [camera, raycaster]);

  // Bresenham line between two cells
  const lineTo = useCallback((from: { x: number; y: number }, to: { x: number; y: number }): { x: number; y: number }[] => {
    const points: { x: number; y: number }[] = [];
    let x0 = from.x, y0 = from.y;
    const x1 = to.x, y1 = to.y;
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    while (true) {
      points.push({ x: x0, y: y0 });
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
    return points;
  }, []);

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (mode !== "edit") return;
    isDragging.current = true;
    strokeCells.current.clear();
    lastCell.current = null;
    (e.target as HTMLElement)?.setPointerCapture?.((e as unknown as PointerEvent).pointerId);
    const uv = getUVFromEvent(e);
    if (uv) {
      lastCell.current = uv;
      if (brush.type === "marker") {
        addMarker(uv.x, uv.y);
      } else {
        strokeCells.current.add(`${uv.x},${uv.y}`);
        applyBrush(uv.x, uv.y);
      }
    }
  }, [mode, brush.type, applyBrush, addMarker, getUVFromEvent]);

  const handlePointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    const uv = getUVFromEvent(e);
    if (uv && heightmap) {
      const h = heightmap[uv.y * HEIGHTMAP_SIZE + uv.x];
      const lat = cellLat(uv.y);
      const lon = cellLon(uv.x);
      setMouseInfo(Math.round(h * 3000), biomeAtHeight(h), lat, lon);
    }
    if (!isDragging.current || mode !== "edit") return;
    if (!uv) return;
    if (brush.type === "marker") return;

    // Interpolate line between last known cell and current cell
    if (lastCell.current) {
      const line = lineTo(lastCell.current, uv);
      for (const p of line) {
        const key = `${p.x},${p.y}`;
        if (!strokeCells.current.has(key)) {
          strokeCells.current.add(key);
          applyBrush(p.x, p.y);
        }
      }
    }
    lastCell.current = uv;
  }, [mode, brush.type, applyBrush, heightmap, setMouseInfo, getUVFromEvent, lineTo]);

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
    lastCell.current = null;
  }, []);

  return (
    <mesh
      ref={meshRef}
      rotation={[-Math.PI / 3, 0, 0]}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <planeGeometry args={[10, 10, HEIGHTMAP_SIZE - 1, HEIGHTMAP_SIZE - 1]} />
    </mesh>
  );
}

// Terrain overlays share the same rotation as the terrain mesh
function TerrainOverlays() {
  const markers = useHeightmapStore((s) => s.markers);
  const heightmap = useHeightmapStore((s) => s.heightmap);
  const riverData = useHeightmapStore((s) => s.riverData);
  const rMask = riverData.riverMask;
  const lMask = riverData.lakeMask;
  const fAccum = riverData.flowAccum;
  const scale = 10 / HEIGHTMAP_SIZE;
  const mode = useHeightmapStore((s) => s.mode);

  const showOverlay = mode === "observing" || !!rMask;

  return (
    <group rotation={[-Math.PI / 3, 0, 0]}>
      {/* Markers */}
      {markers.length > 0 && heightmap &&
        markers.map((m, i) => {
          const h = heightmap[m.y * HEIGHTMAP_SIZE + m.x] * 2 + 0.05;
          const px = (m.x / HEIGHTMAP_SIZE - 0.5) * 10;
          const py = (0.5 - m.y / HEIGHTMAP_SIZE) * 10;
          return (
            <mesh key={`mk${i}`} position={[px, py, h]}>
              <sphereGeometry args={[0.08, 8, 8]} />
              <meshBasicMaterial color="#e8945a" />
            </mesh>
          );
        })}
      {/* Rivers & Lakes */}
      {showOverlay && rMask && heightmap && (() => {
        const elems: React.ReactNode[] = [];
        const step = 2;
        for (let y = 0; y < HEIGHTMAP_SIZE; y += step) {
          for (let x = 0; x < HEIGHTMAP_SIZE; x += step) {
            const i = y * HEIGHTMAP_SIZE + x;
            const h = heightmap[i] * 2;
            const px = (x / HEIGHTMAP_SIZE - 0.5) * 10;
            const py = (0.5 - y / HEIGHTMAP_SIZE) * 10;
            // River width varies with flow accumulation
            const flow = fAccum ? Math.min(1, fAccum[i] / (HEIGHTMAP_SIZE * 4)) : 0.5;
            if (rMask[i]) {
              const w = scale * (1.5 + flow * 4);
              elems.push(
                <mesh key={`r${i}`} position={[px, py, h + 0.02]}>
                  <planeGeometry args={[w, w]} />
                  <meshBasicMaterial color={new THREE.Color().setHSL(0.57, 0.7, 0.35 + flow * 0.3)} side={THREE.DoubleSide} />
                </mesh>
              );
            }
            if (lMask && lMask[i]) {
              elems.push(
                <mesh key={`l${i}`} position={[px, py, h + 0.015]}>
                  <planeGeometry args={[scale * 4, scale * 4]} />
                  <meshBasicMaterial color="#1a5a8a" side={THREE.DoubleSide} opacity={0.8} transparent />
                </mesh>
              );
            }
          }
        }
        return <>{elems}</>;
      })()}
    </group>
  );
}

const SCULPT_TOOLS = ["raise", "lower", "smooth", "water", "marker"]; // "camera" is NOT sculpt — orbit enabled
const ZOOM_2D_THRESHOLD = 18; // camera distance at which 2D toggles on

function SceneControls() {
  const brushType = useHeightmapStore((s) => s.brush.type);
  const setViewMode = useHeightmapStore((s) => s.setViewMode);
  const sculpting = SCULPT_TOOLS.includes(brushType);
  const controlsRef = useRef<any>(null);
  const wasFar = useRef(false);
  const keysDown = useRef<Set<string>>(new Set());

  // Keyboard pan when camera tool is active
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (brushType !== "camera") return;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        keysDown.current.add(e.key);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysDown.current.delete(e.key);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [brushType]);

  useFrame(() => {
    if (!controlsRef.current) return;
    const ctrl = controlsRef.current;
    const cam = ctrl.object as THREE.Camera;
    const target = ctrl.target as THREE.Vector3;
    const dist = cam.position.distanceTo(target);

    // Auto 2D/3D toggle by zoom distance
    if (dist > ZOOM_2D_THRESHOLD && !wasFar.current) {
      wasFar.current = true;
      setViewMode("2d");
    } else if (dist <= ZOOM_2D_THRESHOLD && wasFar.current) {
      wasFar.current = false;
      setViewMode("3d");
    }

    // Arrow key panning via OrbitControls.pan(deltaX, deltaY)
    if (brushType === "camera") {
      const panSpeed = dist * 0.5;
      let dx = 0, dy = 0;
      if (keysDown.current.has("ArrowUp"))    dy -= panSpeed;
      if (keysDown.current.has("ArrowDown"))  dy += panSpeed;
      if (keysDown.current.has("ArrowLeft"))  dx += panSpeed;
      if (keysDown.current.has("ArrowRight")) dx -= panSpeed;

      if (dx !== 0 || dy !== 0) {
        if (typeof ctrl.pan === "function") {
          ctrl.pan(dx, dy);
        } else {
          ctrl.target.x += dx * 0.01;
          ctrl.target.y += dy * 0.01;
        }
      }
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.1}
      maxPolarAngle={Math.PI / 2.2}
      minDistance={4}
      maxDistance={40}
      enableZoom={true}
      enableRotate={!sculpting}
      enablePan={!sculpting}
      mouseButtons={{
        LEFT: sculpting ? undefined : 0,
        MIDDLE: 2,
        RIGHT: 2,
      }}
    />
  );
}

export default function Scene() {
  return (
    <Canvas
      camera={{ position: [0, 8, 6], fov: 50 }}
      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 10, 5]} intensity={0.7} />
      <TerrainMesh />
      <TerrainOverlays />
      <SceneControls />
    </Canvas>
  );
}
