import { useRef, useCallback, useEffect } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useHeightmapStore } from "../store/heightmap";
import {
  createTerrainMaterial,
} from "../render/TerrainMaterial";
import { HEIGHTMAP_SIZE } from "../types";

function TerrainMesh() {
  const meshRef = useRef<THREE.Mesh>(null!);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const textureRef = useRef<THREE.DataTexture | null>(null);
  const heightmap = useHeightmapStore((s) => s.heightmap);
  const mode = useHeightmapStore((s) => s.mode);
  const brush = useHeightmapStore((s) => s.brush);
  const applyBrush = useHeightmapStore((s) => s.applyBrush);
  const { camera, raycaster } = useThree();
  const isDragging = useRef(false);

  // Initialize material
  useEffect(() => {
    if (!heightmap) return;
    const { material, texture } = createTerrainMaterial(heightmap);
    materialRef.current = material;
    textureRef.current = texture;
    if (meshRef.current) {
      meshRef.current.material = material;
    }
    return () => {
      material.dispose();
      texture.dispose();
    };
  }, []);

  // Update heightmap texture when heightmap changes
  useEffect(() => {
    if (!heightmap || !materialRef.current) return;
    // Update the heightmap data in-place in the existing texture
    const tex = materialRef.current.uniforms.uHeightmap
      .value as THREE.DataTexture;
    if (tex) {
      tex.image.data = heightmap;
      tex.needsUpdate = true;
    }
  }, [heightmap]);

  // Mouse interaction for terrain sculpting
  const handlePointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (mode !== "edit") return;
      isDragging.current = true;
      (e.target as HTMLElement)?.setPointerCapture?.((e as unknown as PointerEvent).pointerId);
    },
    [mode]
  );

  const handlePointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!isDragging.current || mode !== "edit") return;
      if (!meshRef.current) return;
      const evt = e as unknown as PointerEvent;

      raycaster.setFromCamera(
        new THREE.Vector2(
          (evt.clientX / window.innerWidth) * 2 - 1,
          -(evt.clientY / window.innerHeight) * 2 + 1
        ),
        camera
      );

      const intersects = raycaster.intersectObject(meshRef.current);
      if (intersects.length > 0) {
        const uv = intersects[0].uv;
        if (uv) {
          const x = Math.floor(uv.x * HEIGHTMAP_SIZE);
          const y = Math.floor((1 - uv.y) * HEIGHTMAP_SIZE);
          applyBrush(x, y);
        }
      }
    },
    [mode, brush, camera, raycaster, applyBrush]
  );

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  // Update contour interval uniform
  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uContourInterval.value = 0.05;
    }
  });

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

export default function Scene() {
  return (
    <Canvas
      camera={{ position: [0, 8, 6], fov: 50 }}
      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 10, 5]} intensity={0.8} />
      <TerrainMesh />
      <OrbitControls
        enableDamping
        dampingFactor={0.1}
        maxPolarAngle={Math.PI / 2.2}
      />
    </Canvas>
  );
}
