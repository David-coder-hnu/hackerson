import { useRef, useCallback, useEffect } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Line, Text } from "@react-three/drei";
import * as THREE from "three";
import { useHeightmapStore } from "../store/heightmap";
import { createTerrainMaterial, setClimateTextures } from "../render/TerrainMaterial";
import { createRiverMaterial, createLakeMaterial } from "../render/WaterMaterial";
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

function TerrainMesh({ onCustomClick }: { onCustomClick?: (x: number, y: number) => void }) {
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
  const activeTool = useHeightmapStore((s) => s.activeTool);
  const multiTouchActive = useHeightmapStore((s) => s.multiTouchActive);
  const { camera, raycaster, gl } = useThree();
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
    const nativeEvent = e.nativeEvent as PointerEvent;
    if (nativeEvent.pointerType === "mouse" && nativeEvent.button !== 0) return;
    if (nativeEvent.pointerType === "touch" && multiTouchActive) return;

    // Custom tools in observation mode
    if (mode === "observing" && (activeTool === "pin" || activeTool === "region")) {
      const uv = getUVFromEvent(e);
      if (uv && onCustomClick) onCustomClick(uv.x, uv.y);
      return;
    }

    if (mode !== "edit") return;

    isDragging.current = true;
    strokeCells.current.clear();
    lastCell.current = null;
    const canvas = gl.domElement as HTMLElement;
    canvas.setPointerCapture(nativeEvent.pointerId);
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
  }, [mode, activeTool, brush.type, applyBrush, addMarker, getUVFromEvent, multiTouchActive, gl, onCustomClick]);

  const handlePointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    const nativeEvent = e.nativeEvent as PointerEvent;
    const uv = getUVFromEvent(e);
    if (uv && heightmap) {
      const h = heightmap[uv.y * HEIGHTMAP_SIZE + uv.x];
      const lat = cellLat(uv.y);
      const lon = cellLon(uv.x);
      setMouseInfo(Math.round((h - 0.15) * 3000), biomeAtHeight(h), lat, lon);
    }
    if (!isDragging.current || mode !== "edit") return;
    // Only draw while left button is held
    if (nativeEvent.pointerType === "mouse" && nativeEvent.buttons !== 1) return;
    // Cancel stroke if multi-touch activates mid-draw
    if (nativeEvent.pointerType === "touch" && multiTouchActive) {
      isDragging.current = false;
      lastCell.current = null;
      return;
    }
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
  }, [mode, brush.type, applyBrush, heightmap, setMouseInfo, getUVFromEvent, lineTo, multiTouchActive]);

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

// All terrain overlays (markers + rivers + lakes) in one rotated group
function TerrainOverlays({ onPinHover, onCustomPinHover }: { onPinHover: (i: number | null) => void; onCustomPinHover?: (id: string | null) => void }) {
  const markers = useHeightmapStore((s) => s.markers);
  const customPins = useHeightmapStore((s) => s.customPins);
  const customRegions = useHeightmapStore((s) => s.customRegions);
  const heightmap = useHeightmapStore((s) => s.heightmap);
  const riverPaths = useHeightmapStore((s) => s.riverData.riverPaths);
  const lakeRegions = useHeightmapStore((s) => s.riverData.lakeRegions);
  const mode = useHeightmapStore((s) => s.mode);
  const riverMat = useRef<THREE.ShaderMaterial>(createRiverMaterial());
  const lakeMat = useRef<THREE.ShaderMaterial>(createLakeMaterial());
  const showWater = mode === "observing" || !!riverPaths;

  // Animate water
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (riverMat.current) riverMat.current.uniforms.uTime.value = t;
    if (lakeMat.current) lakeMat.current.uniforms.uTime.value = t;
  });

  const toWorld = useCallback((x: number, y: number, z: number) => {
    return [
      (x / HEIGHTMAP_SIZE - 0.5) * 10,
      (y / HEIGHTMAP_SIZE - 0.5) * 10,
      z,
    ] as const;
  }, []);

  return (
    <group rotation={[-Math.PI / 3, 0, 0]}>
      {/* Markers */}
      {markers.length > 0 && heightmap &&
        markers.map((m, i) => {
          const h = heightmap[m.y * HEIGHTMAP_SIZE + m.x] * 2;
          const [px, py] = toWorld(m.x, m.y, 0);
          const hasAnalysis = !!m.analysis;
          const color = hasAnalysis ? "#4ae0a0" : "#e8945a";
          return (
            <group
              key={`mk${i}`}
              position={[px, py, h]}
              onPointerEnter={() => hasAnalysis && onPinHover(i)}
              onPointerLeave={() => onPinHover(null)}
            >
              {/* Pin shaft */}
              <mesh position={[0, 0, 0.06]}>
                <cylinderGeometry args={[0.012, 0.018, 0.12, 6]} />
                <meshBasicMaterial color="#888" />
              </mesh>
              {/* Pin head */}
              <mesh position={[0, 0, 0.13]}>
                <sphereGeometry args={[0.04, 8, 8]} />
                <meshBasicMaterial color={color} />
              </mesh>
            </group>
          );
        })}
      {/* Custom pins (worldbuilding) */}
      {customPins.length > 0 && heightmap &&
        customPins.map((cp) => {
          const h = heightmap[cp.y * HEIGHTMAP_SIZE + cp.x] * 2;
          const [px, py] = toWorld(cp.x, cp.y, 0);
          return (
            <group
              key={`cp${cp.id}`}
              position={[px, py, h]}
              onPointerEnter={() => onCustomPinHover?.(cp.id)}
              onPointerLeave={() => onCustomPinHover?.(null)}
            >
              <mesh position={[0, 0, 0.06]}>
                <cylinderGeometry args={[0.012, 0.018, 0.12, 6]} />
                <meshBasicMaterial color="#888" />
              </mesh>
              <mesh position={[0, 0, 0.13]}>
                <sphereGeometry args={[0.04, 8, 8]} />
                <meshBasicMaterial color="#f0c040" />
              </mesh>
            </group>
          );
        })}
      {/* Custom regions (worldbuilding) */}
      {customRegions.length > 0 && heightmap &&
        customRegions.map((cr) => {
          if (cr.points.length < 2) return null;
          // Sample terrain height along each edge to avoid cutting through mountains
          const sampled: THREE.Vector3[] = [];
          for (let i = 0; i < cr.points.length; i++) {
            const a = cr.points[i];
            const b = cr.points[(i + 1) % cr.points.length];
            // Bresenham line between a and b, sample height at each step
            let x0 = a.x, y0 = a.y;
            const dx = Math.abs(b.x - x0), dy = Math.abs(b.y - y0);
            const sx = x0 < b.x ? 1 : -1, sy = y0 < b.y ? 1 : -1;
            let err = dx - dy;
            while (true) {
              const idx = y0 * HEIGHTMAP_SIZE + x0;
              const h = heightmap[idx] * 2 + 0.06;
              const [px, py] = toWorld(x0, y0, 0);
              sampled.push(new THREE.Vector3(px, py, h));
              if (x0 === b.x && y0 === b.y) break;
              const e2 = 2 * err;
              if (e2 > -dy) { err -= dy; x0 += sx; }
              if (e2 < dx) { err += dx; y0 += sy; }
            }
          }
          return (
            <group key={`cr${cr.id}`}>
              <Line points={(() => { const c = new THREE.CatmullRomCurve3(sampled, false, "catmullrom", 0.25); return c.getPoints(sampled.length); })()} color="#f0c040" lineWidth={1.5} />
              {(() => {
                const cx = cr.points.reduce((s, p) => s + p.x, 0) / cr.points.length;
                const cy = cr.points.reduce((s, p) => s + p.y, 0) / cr.points.length;
                const ch = heightmap[Math.round(cy) * HEIGHTMAP_SIZE + Math.round(cx)] * 2 + 0.15;
                const [cpx, cpy] = toWorld(Math.round(cx), Math.round(cy), 0);
                return (
                  <Text
                    position={[cpx, cpy, ch]}
                    fontSize={0.12}
                    color="#f0c040"
                    anchorX="center"
                    anchorY="middle"
                    outlineWidth={0.02}
                    outlineColor="#1a1816"
                  >
                    {cr.name}
                  </Text>
                );
              })()}
            </group>
          );
        })}
      {/* River lines */}
      {showWater && riverPaths && heightmap && riverPaths.map((path, pi) => {
        const points = path.map(([x, y]) => {
          const h = heightmap[y * HEIGHTMAP_SIZE + x] * 2 + 0.025;
          const [px, py] = toWorld(x, y, 0);
          return new THREE.Vector3(px, py, h);
        });
        if (points.length < 2) return null;
        const curve = new THREE.CatmullRomCurve3(points);
        const curvePts = curve.getPoints(points.length * 2);
        return (
          <Line
            key={`rv${pi}`}
            points={curvePts}
            color="#8ABAE0"
            lineWidth={1.5}
          />
        );
      })}
      {/* Lake regions as filled shapes */}
      {showWater && lakeRegions && heightmap && lakeRegions.map((region, ri) => {
        if (region.length < 5) return null;
        const avgH = region.reduce((s, [x, y]) => s + heightmap[y * HEIGHTMAP_SIZE + x] * 2, 0) / region.length + 0.015;

        // Create shape from convex hull of region points
        const worldPts = region.map(([x, y]) => {
          const [px, py] = toWorld(x, y, 0);
          return new THREE.Vector2(px, py);
        });
        // Use first 32 perimeter points for simplicity
        const simplified = worldPts.filter((_, i) => i % Math.max(1, Math.floor(worldPts.length / 32)) === 0);
        if (simplified.length < 3) return null;
        const shape = new THREE.Shape(simplified);
        const shapeGeom = new THREE.ShapeGeometry(shape);
        return (
          <mesh key={`lk${ri}`} position={[0, 0, avgH]} material={lakeMat.current}>
            <primitive object={shapeGeom} />
          </mesh>
        );
      })}
    </group>
  );
}

const ZOOM_2D_THRESHOLD = 18; // camera distance at which 2D toggles on

function SceneControls() {
  const setViewMode = useHeightmapStore((s) => s.setViewMode);
  const setMultiTouchActive = useHeightmapStore((s) => s.setMultiTouchActive);
  const controlsRef = useRef<any>(null);
  const wasFar = useRef(false);
  const keysDown = useRef<Set<string>>(new Set());
  const { gl } = useThree();

  // ---- Keyboard handling (always active) ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const gameKeys = [
        "KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE",
        "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
      ];
      if (gameKeys.includes(e.code)) {
        e.preventDefault();
        keysDown.current.add(e.code);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysDown.current.delete(e.code);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // ---- Multi-touch detection (suppress draw during 2-finger gestures) ----
  useEffect(() => {
    const canvas = gl.domElement;
    if (!canvas) return;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length >= 2) setMultiTouchActive(true);
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) setMultiTouchActive(false);
    };
    canvas.addEventListener("touchstart", onTouchStart);
    canvas.addEventListener("touchend", onTouchEnd);
    canvas.addEventListener("touchcancel", onTouchEnd);
    return () => {
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [gl, setMultiTouchActive]);

  // ---- Two-finger rotation supplement (OrbitControls doesn't natively rotate with DollyPan) ----
  useEffect(() => {
    const canvas = gl.domElement;
    if (!canvas) return;
    let lastAngle = 0;
    let isTwoFinger = false;

    const getAngle = (touches: TouchList): number => {
      const dx = touches[1].clientX - touches[0].clientX;
      const dy = touches[1].clientY - touches[0].clientY;
      return Math.atan2(dy, dx);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        lastAngle = getAngle(e.touches);
        isTwoFinger = true;
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      const ctrl = controlsRef.current;
      if (!ctrl || !isTwoFinger || e.touches.length !== 2) return;
      const currentAngle = getAngle(e.touches);
      const angleDelta = currentAngle - lastAngle;
      if (Math.abs(angleDelta) > 0.0005) {
        ctrl.setAzimuthalAngle(ctrl.getAzimuthalAngle() - angleDelta);
      }
      lastAngle = currentAngle;
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) isTwoFinger = false;
    };
    canvas.addEventListener("touchstart", onTouchStart);
    canvas.addEventListener("touchmove", onTouchMove, { passive: true });
    canvas.addEventListener("touchend", onTouchEnd);
    return () => {
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
  }, [gl]);

  // ---- Per-frame: auto 2D/3D toggle + keyboard movement ----
  useFrame((_, delta) => {
    if (!controlsRef.current) return;
    const ctrl = controlsRef.current;
    const cam = ctrl.object as THREE.Camera;
    const target = ctrl.target as THREE.Vector3;
    const dist = cam.position.distanceTo(target);

    // Auto 2D/3D toggle by zoom distance
    const targetTopDown = dist > ZOOM_2D_THRESHOLD;
    if (targetTopDown && !wasFar.current) {
      wasFar.current = true;
      setViewMode("2d");
    } else if (!targetTopDown && wasFar.current) {
      wasFar.current = false;
      setViewMode("3d");
    }

    // Dynamic max polar angle: top-down when far, tilted when close
    ctrl.maxPolarAngle = targetTopDown ? 0.25 : Math.PI / 2.2;

    // ---- Keyboard pan (WASD + Arrow keys) ----
    const panSpeed = dist * 0.5;
    let dx = 0, dy = 0;
    if (keysDown.current.has("KeyW") || keysDown.current.has("ArrowUp"))    dy -= panSpeed;
    if (keysDown.current.has("KeyS") || keysDown.current.has("ArrowDown"))  dy += panSpeed;
    if (keysDown.current.has("KeyA") || keysDown.current.has("ArrowLeft"))  dx += panSpeed;
    if (keysDown.current.has("KeyD") || keysDown.current.has("ArrowRight")) dx -= panSpeed;

    if (dx !== 0 || dy !== 0) {
      if (typeof ctrl.pan === "function") {
        ctrl.pan(dx * delta * 2, dy * delta * 2);
      } else {
        target.x += dx * 0.01;
        target.y += dy * 0.01;
      }
    }

    // ---- Keyboard rotation (Q = left, E = right) ----
    const rotateSpeed = 1.5;
    if (keysDown.current.has("KeyQ")) {
      ctrl.setAzimuthalAngle(ctrl.getAzimuthalAngle() + rotateSpeed * delta);
    }
    if (keysDown.current.has("KeyE")) {
      ctrl.setAzimuthalAngle(ctrl.getAzimuthalAngle() - rotateSpeed * delta);
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
      enableRotate={true}
      enablePan={true}
      mouseButtons={{
        LEFT: undefined as any,
        MIDDLE: THREE.MOUSE.PAN,
        RIGHT: THREE.MOUSE.ROTATE,
      }}
      touches={{
        ONE: undefined as any,
        TWO: THREE.TOUCH.DOLLY_PAN,
      }}
    />
  );
}

export default function Scene({ onPinHover, onCustomClick, onCustomPinHover }: { onPinHover: (i: number | null) => void; onCustomClick?: (x: number, y: number) => void; onCustomPinHover?: (id: string | null) => void }) {
  return (
    <Canvas
      camera={{ position: [0, 8, 6], fov: 50 }}
      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 10, 5]} intensity={0.7} />
      <TerrainMesh onCustomClick={onCustomClick} />
      <TerrainOverlays onPinHover={onPinHover} onCustomPinHover={onCustomPinHover} />
      <SceneControls />
    </Canvas>
  );
}
