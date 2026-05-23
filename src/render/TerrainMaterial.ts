import * as THREE from "three";
import { HEIGHTMAP_SIZE } from "../types";

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  uniform sampler2D uHeightmap;
  uniform float uHeightScale;
  uniform float uResolution;

  void main() {
    vUv = uv;
    float h = texture2D(uHeightmap, uv).r;
    vec3 pos = position;
    pos.z += h * uHeightScale;
    vWorldPos = pos;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  uniform float uContourInterval;
  uniform float uContourWidth;
  uniform vec3 uBaseColor;
  uniform vec3 uContourColor;
  uniform float uHeightScale;

  void main() {
    float elevation = vWorldPos.z / uHeightScale;
    float halfWidth = uContourWidth;
    float contour = abs(fract(elevation / uContourInterval + 0.5) - 0.5) / fwidth(elevation);
    float line = 1.0 - smoothstep(0.0, halfWidth, contour);

    // Height-based color: low = darker sand, high = lighter rock
    float h = clamp(elevation, 0.0, 1.0);
    vec3 lowColor = vec3(0.25, 0.20, 0.15);
    vec3 highColor = vec3(0.55, 0.50, 0.45);
    vec3 baseCol = mix(lowColor, highColor, h);

    // Mix contour lines over the base
    vec3 color = mix(baseCol, uContourColor, line * 0.6);

    // Simple directional light
    float light = 0.5 + 0.5 * dot(normalize(vec3(1.0, 1.0, 1.0)), vec3(0.0, 0.0, 1.0));
    color *= light;

    gl_FragColor = vec4(color, 1.0);
  }
`;

export function createTerrainMaterial(heightmapData: Float32Array): {
  material: THREE.ShaderMaterial;
  texture: THREE.DataTexture;
} {
  const texture = new THREE.DataTexture(
    heightmapData,
    HEIGHTMAP_SIZE,
    HEIGHTMAP_SIZE,
    THREE.RedFormat,
    THREE.FloatType
  );
  texture.needsUpdate = true;

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uHeightmap: { value: texture },
      uHeightScale: { value: 2.0 },
      uResolution: { value: HEIGHTMAP_SIZE },
      uContourInterval: { value: 0.05 },
      uContourWidth: { value: 0.3 },
      uBaseColor: { value: new THREE.Color(0x3d3226) },
      uContourColor: { value: new THREE.Color(0xe8945a) },
    },
    side: THREE.DoubleSide,
  });

  return { material, texture };
}

export function updateTerrainTexture(
  material: THREE.ShaderMaterial,
  heightmapData: Float32Array
): void {
  const oldTexture = material.uniforms.uHeightmap.value as THREE.DataTexture;
  if (oldTexture) oldTexture.dispose();

  const texture = new THREE.DataTexture(
    heightmapData,
    HEIGHTMAP_SIZE,
    HEIGHTMAP_SIZE,
    THREE.RedFormat,
    THREE.FloatType
  );
  texture.needsUpdate = true;
  material.uniforms.uHeightmap.value = texture;
}
