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
  uniform float uHeightScale;
  uniform float uViewMode; // 0 = 3D realistic, 1 = 2D contour

  // Elevation color ramp for 2D contour mode
  vec3 contourColor(float h) {
    if (h < 0.05) return vec3(0.08, 0.18, 0.50); // deep ocean
    if (h < 0.12) return vec3(0.10, 0.35, 0.70); // shallow ocean
    if (h < 0.18) return vec3(0.15, 0.55, 0.65); // coastal
    if (h < 0.25) return vec3(0.22, 0.60, 0.28); // lowland green
    if (h < 0.35) return vec3(0.40, 0.65, 0.20); // grassland
    if (h < 0.45) return vec3(0.55, 0.62, 0.18); // yellow-green
    if (h < 0.55) return vec3(0.68, 0.55, 0.20); // yellow
    if (h < 0.65) return vec3(0.60, 0.40, 0.18); // orange-brown
    if (h < 0.75) return vec3(0.48, 0.28, 0.12); // brown
    if (h < 0.85) return vec3(0.38, 0.22, 0.10); // dark brown
    return vec3(0.55, 0.50, 0.50); // snow/rock
  }

  // Realistic color for 3D mode
  vec3 realisticColor(float h) {
    if (h < 0.05) return vec3(0.05, 0.12, 0.38);
    if (h < 0.10) return vec3(0.08, 0.22, 0.55);
    if (h < 0.15) return vec3(0.12, 0.38, 0.60);
    if (h < 0.20) return vec3(0.55, 0.52, 0.35); // sandy coast
    if (h < 0.30) return vec3(0.25, 0.50, 0.18); // green lowland
    if (h < 0.45) return vec3(0.18, 0.42, 0.15); // forest
    if (h < 0.60) return vec3(0.35, 0.32, 0.18); // highland
    if (h < 0.75) return vec3(0.40, 0.30, 0.18); // mountain
    if (h < 0.90) return vec3(0.50, 0.45, 0.40); // rock
    return vec3(0.75, 0.73, 0.70); // snow
  }

  void main() {
    float elevation = vWorldPos.z / uHeightScale;
    float h = clamp(elevation, 0.0, 1.0);

    if (uViewMode > 0.5) {
      // 2D Contour mode — layered elevation colors with contour lines
      vec3 baseCol = contourColor(h);

      // Contour lines
      float interval = uContourInterval;
      float halfW = uContourWidth;
      float c = abs(fract(h / interval + 0.5) - 0.5) / fwidth(h);
      float line = 1.0 - smoothstep(0.0, halfW, c);

      // Blend contour lines over the base color
      vec3 color = mix(baseCol, vec3(0.2, 0.2, 0.2), line * 0.35);
      gl_FragColor = vec4(color, 1.0);
    } else {
      // 3D Realistic mode — natural terrain colors with lighting
      vec3 baseCol = realisticColor(h);

      // Simple directional lighting from above
      vec3 normal = vec3(0.0, 0.0, 1.0);
      vec3 lightDir = normalize(vec3(0.5, 0.8, 1.0));
      float diff = 0.4 + 0.6 * max(dot(normal, lightDir), 0.0);

      // Water effect: darker blue with depth, slight transparency feel
      if (h < 0.15) {
        float depth = (0.15 - h) / 0.15;
        baseCol = mix(vec3(0.08, 0.25, 0.55), vec3(0.04, 0.15, 0.40), depth);
        diff = 0.6 + 0.4 * diff; // water reflects more
      }

      vec3 color = baseCol * diff;

      // Subtle fog at high elevation
      if (h > 0.7) {
        float fog = (h - 0.7) / 0.3;
        color = mix(color, vec3(0.7, 0.7, 0.7), fog * 0.3);
      }

      gl_FragColor = vec4(color, 1.0);
    }
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
      uContourInterval: { value: 0.04 },
      uContourWidth: { value: 0.3 },
      uViewMode: { value: 0 },
    },
    side: THREE.DoubleSide,
  });

  return { material, texture };
}
