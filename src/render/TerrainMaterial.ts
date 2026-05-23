import * as THREE from "three";
import { HEIGHTMAP_SIZE } from "../types";

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vViewPos;
  uniform sampler2D uHeightmap;
  uniform float uHeightScale;

  void main() {
    vUv = uv;
    float h = texture2D(uHeightmap, uv).r;
    vec3 pos = position;
    pos.z += h * uHeightScale;
    vWorldPos = pos;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    vViewPos = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vViewPos;
  uniform float uContourInterval;
  uniform float uContourWidth;
  uniform float uHeightScale;
  uniform float uViewMode;
  uniform sampler2D uHeightmap;
  uniform float uResolution;

  // ---- Hash / noise for texture variation ----
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 2; i++) {
      v += a * noise(p);
      p *= 2.5;
      a *= 0.5;
    }
    return v;
  }

  // ---- Approximate slope from heightmap ----
  float slopeAt(vec2 uv) {
    float s = 1.0 / uResolution;
    float h0 = texture2D(uHeightmap, uv).r;
    float hx = texture2D(uHeightmap, uv + vec2(s, 0.0)).r;
    float hy = texture2D(uHeightmap, uv + vec2(0.0, s)).r;
    return sqrt((hx - h0) * (hx - h0) + (hy - h0) * (hy - h0)) / s;
  }

  // ---- Ocean color with depth ----
  vec3 oceanColor(float h, float slope) {
    // Deep abyssal to shallow turquoise
    vec3 deep   = vec3(0.012, 0.045, 0.160);
    vec3 abyss  = vec3(0.018, 0.065, 0.210);
    vec3 ocean  = vec3(0.025, 0.100, 0.280);
    vec3 mid    = vec3(0.035, 0.155, 0.360);
    vec3 shallow= vec3(0.055, 0.210, 0.440);
    vec3 reef   = vec3(0.100, 0.310, 0.520);
    vec3 shelf  = vec3(0.180, 0.420, 0.600);

    float t;
    vec3 col;
    if (h < 0.04) { t = h / 0.04; col = mix(deep, abyss, t); }
    else if (h < 0.07) { t = (h - 0.04) / 0.03; col = mix(abyss, ocean, t); }
    else if (h < 0.10) { t = (h - 0.07) / 0.03; col = mix(ocean, mid, t); }
    else if (h < 0.12) { t = (h - 0.10) / 0.02; col = mix(mid, shallow, t); }
    else if (h < 0.14) { t = (h - 0.12) / 0.02; col = mix(shallow, reef, t); }
    else { t = (h - 0.14) / 0.05; col = mix(reef, shelf, clamp(t, 0.0, 1.0)); }

    // Subtle noise variation on seafloor
    float n = fbm(vUv * uResolution * 0.5) * 0.03;
    col = mix(col, col * 1.1, n);

    return col;
  }

  // ---- Shoreline transition ----
  vec3 shoreColor(float h, float slope, vec2 uv) {
    float shoreStart = 0.14;
    float shoreEnd   = 0.22;
    float t = smoothstep(shoreStart, shoreEnd, h);

    vec3 wet   = vec3(0.40, 0.42, 0.38);
    vec3 sand  = vec3(0.68, 0.62, 0.45);
    vec3 dry   = vec3(0.72, 0.66, 0.42);

    // Wet sand near water, dry further up
    float wetZone = smoothstep(0.14, 0.16, h);
    vec3 shore = mix(wet, sand, wetZone);
    shore = mix(shore, dry, smoothstep(0.18, 0.22, h));

    // Texture variation on beach
    float n = fbm(uv * uResolution * 2.0) * 0.04;
    return shore + n;
  }

  // ---- Land color: satellite-style green/brown gradation ----
  vec3 landColor(float h, float slope, vec2 uv) {
    float n = fbm(uv * uResolution * 1.5) * 0.04;

    // Base land colors
    vec3 lowGreen   = vec3(0.250, 0.440, 0.160);  // grassland
    vec3 forest     = vec3(0.140, 0.340, 0.110);  // dark forest
    vec3 highForest = vec3(0.180, 0.360, 0.130);  // upland forest
    vec3 highland   = vec3(0.380, 0.340, 0.200);  // scrub/grass
    vec3 rock       = vec3(0.480, 0.420, 0.340);  // exposed rock
    vec3 scree      = vec3(0.550, 0.500, 0.440);  // scree/talus
    vec3 snow       = vec3(0.850, 0.840, 0.810);  // snow

    // Height-based mix
    float t1 = smoothstep(0.22, 0.38, h);  // green → forest
    float t2 = smoothstep(0.38, 0.52, h);  // forest → high forest
    float t3 = smoothstep(0.52, 0.65, h);  // high forest → highland
    float t4 = smoothstep(0.65, 0.78, h);  // highland → rock
    float t5 = smoothstep(0.78, 0.88, h);  // rock → scree
    float t6 = smoothstep(0.88, 0.95, h);  // scree → snow

    vec3 col = mix(lowGreen, forest, t1);
    col = mix(col, highForest, t2);
    col = mix(col, highland, t3);
    col = mix(col, rock, t4);
    col = mix(col, scree, t5);
    col = mix(col, snow, t6);

    // Slope steepens color: steeper = more rock/grey, gentler = greener
    float steep = smoothstep(0.08, 0.40, slope);
    col = mix(col, rock * 0.9, steep * 0.5);

    // Noise variation for natural patchiness
    col += n;

    return col;
  }

  // ---- 2D contour colors (improved) ----
  vec3 contourColor(float h, float slope) {
    if (h < 0.04) return mix(vec3(0.02,0.05,0.16), vec3(0.03,0.08,0.24), h/0.04);
    if (h < 0.08) return mix(vec3(0.03,0.08,0.24), vec3(0.06,0.18,0.38), (h-0.04)/0.04);
    if (h < 0.12) return mix(vec3(0.06,0.18,0.38), vec3(0.12,0.30,0.52), (h-0.08)/0.04);
    if (h < 0.15) return mix(vec3(0.12,0.30,0.52), vec3(0.22,0.44,0.60), (h-0.12)/0.03);
    if (h < 0.18) return mix(vec3(0.50,0.50,0.38), vec3(0.32,0.55,0.22), (h-0.15)/0.03);
    if (h < 0.30) return mix(vec3(0.32,0.55,0.22), vec3(0.18,0.40,0.14), (h-0.18)/0.12);
    if (h < 0.45) return mix(vec3(0.18,0.40,0.14), vec3(0.25,0.38,0.16), (h-0.30)/0.15);
    if (h < 0.58) return mix(vec3(0.25,0.38,0.16), vec3(0.40,0.36,0.20), (h-0.45)/0.13);
    if (h < 0.72) return mix(vec3(0.40,0.36,0.20), vec3(0.50,0.42,0.36), (h-0.58)/0.14);
    if (h < 0.88) return mix(vec3(0.50,0.42,0.36), vec3(0.42,0.30,0.16), (h-0.72)/0.16);
    return vec3(0.82,0.80,0.76);
  }

  void main() {
    float h = clamp(vWorldPos.z / uHeightScale, 0.0, 1.0);
    float slope = slopeAt(vUv);
    float viewDist = length(vViewPos);

    if (uViewMode > 0.5) {
      // ---- 2D Contour mode ----
      vec3 baseCol = contourColor(h, slope);
      float interval = uContourInterval;
      float halfW = uContourWidth;
      float c = abs(fract(h / interval + 0.5) - 0.5) / fwidth(h);
      float line = 1.0 - smoothstep(0.0, halfW, c);
      vec3 color = mix(baseCol, vec3(0.15, 0.15, 0.15), line * 0.3);
      gl_FragColor = vec4(color, 1.0);

    } else {
      // ---- 3D Satellite mode ----
      vec3 col;

      if (h < 0.14) {
        // Ocean
        col = oceanColor(h, slope);
      } else if (h < 0.22) {
        // Shoreline transition
        col = shoreColor(h, slope, vUv);
      } else {
        // Land
        col = landColor(h, slope, vUv);
      }

      // ---- Lighting ----
      // Approximate normal from slope
      float sx = slope * 0.6;
      vec3 approxNormal = normalize(vec3(-sx, -sx, 1.0));
      vec3 lightDir = normalize(vec3(0.4, 0.7, 0.6));
      float NdotL = max(dot(approxNormal, lightDir), 0.0);
      float diff = 0.35 + 0.65 * NdotL;

      // Specular on water
      float spec = 0.0;
      if (h < 0.14) {
        vec3 viewDir = normalize(-vViewPos);
        vec3 halfVec = normalize(lightDir + viewDir);
        spec = pow(max(dot(approxNormal, halfVec), 0.0), 80.0) * 0.25;
      }

      col *= diff;
      col += spec * vec3(0.9, 0.85, 0.7);

      // ---- Atmospheric perspective ----
      float haze = 1.0 - exp(-viewDist * 0.06);
      vec3 hazeColor = vec3(0.55, 0.60, 0.72);
      col = mix(col, hazeColor, haze * 0.35);

      // Slight blue tint at high elevation (atmospheric scattering)
      if (h > 0.6) {
        float altitude = (h - 0.6) / 0.4;
        col = mix(col, col * vec3(0.9, 0.92, 1.0), altitude * 0.2);
      }

      gl_FragColor = vec4(col, 1.0);
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
