import { useRef, useCallback, useEffect } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useHeightmapStore } from "../store/heightmap";
import { createTerrainMaterial } from "../render/TerrainMaterial";
import { HEIGHTMAP_SIZE } from "../types";

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
  const { camera, raycaster } = useThree();
  const isDragging = useRef(false);

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
        y: Math.floor((1 - hits[0].uv.y) * HEIGHTMAP_SIZE),
      };
    }
    return null;
  }, [camera, raycaster]);

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (mode !== "edit") return;
    isDragging.current = true;
    (e.target as HTMLElement)?.setPointerCapture?.((e as unknown as PointerEvent).pointerId);
    const uv = getUVFromEvent(e);
    if (uv) {
      if (brush.type === "marker") {
        addMarker(uv.x, uv.y);
      } else {
        applyBrush(uv.x, uv.y);
      }
    }
  }, [mode, brush.type, applyBrush, addMarker, getUVFromEvent]);

  const handlePointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    const uv = getUVFromEvent(e);
    if (uv && heightmap) {
      const h = heightmap[uv.y * HEIGHTMAP_SIZE + uv.x];
      setMouseInfo(Math.round(h * 3000), biomeAtHeight(h));
    }
    if (!isDragging.current || mode !== "edit") return;
    if (uv && brush.type !== "marker") applyBrush(uv.x, uv.y);
  }, [mode, brush.type, applyBrush, heightmap, setMouseInfo, getUVFromEvent]);

  const handlePointerUp = useCallback(() => { isDragging.current = false; }, []);

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

function MarkerDots() {
  const markers = useHeightmapStore((s) => s.markers);
  const heightmap = useHeightmapStore((s) => s.heightmap);
  if (markers.length === 0 || !heightmap) return null;

  return (
    <>
      {markers.map((m, i) => {
        const h = heightmap[m.y * HEIGHTMAP_SIZE + m.x] * 2 + 0.05;
        const px = (m.x / HEIGHTMAP_SIZE - 0.5) * 10;
        const py = (0.5 - m.y / HEIGHTMAP_SIZE) * 10;
        return (
          <mesh key={i} position={[px, py, h]}>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshBasicMaterial color="#e8945a" />
          </mesh>
        );
      })}
    </>
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
      <MarkerDots />
      <OrbitControls enableDamping dampingFactor={0.1} maxPolarAngle={Math.PI / 2.2} />
    </Canvas>
  );
}
