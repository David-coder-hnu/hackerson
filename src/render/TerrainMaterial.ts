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
  uniform sampler2D uPrecipMap;
  uniform sampler2D uTempMap;
  uniform float uHasClimate;
  uniform float uClimateBlend; // 0-1 animates climate overlay in
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

  // ---- Ocean: 3 distinct bands, no blurring ----
  vec3 oceanColor(float h, float slope) {
    float d = 1.0 - h / 0.15;
    d = clamp(d, 0.0, 1.0);
    // 浅海 #B0D4FF / 深海 #4A7A9C / 深渊 #1A3B4C
    vec3 shallow = vec3(0.690, 0.831, 1.000);
    vec3 deep    = vec3(0.290, 0.478, 0.612);
    vec3 trench  = vec3(0.102, 0.231, 0.298);
    vec3 col;
    if (d < 0.3) col = mix(shallow, deep, d / 0.3);
    else if (d < 0.7) col = mix(deep, trench, (d - 0.3) / 0.4);
    else col = trench;
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

  // ---- Latitude-driven snow line ----
  float snowLine(float lat, float h) {
    float absLat = abs(lat);
    float snowH = 0.88 - absLat * 0.011;
    snowH = clamp(snowH, 0.04, 0.92);
    return smoothstep(snowH - 0.05, snowH + 0.05, h);
  }

  float polarIce(float lat) {
    return smoothstep(60.0, 75.0, abs(lat));
  }

  // ---- National Geographic-style hypsometric ----
  vec3 landColorNoClimate(float h, float slope, vec2 uv) {
    float elev = (h - 0.15) * 3.0;
    float lat = uv.y * 180.0 - 90.0;

    // High-contrast NG-style: 深绿→亮黄绿→金黄→赤褐→红棕→纯白
    vec3 meadow  = vec3(0.235, 0.471, 0.220); // 0m   深草绿
    vec3 brightG = vec3(0.482, 0.682, 0.278); // 200m 亮黄绿
    vec3 goldY   = vec3(0.890, 0.741, 0.341); // 500m 金黄色
    vec3 rustO   = vec3(0.820, 0.420, 0.220); // 1500m 赤褐色
    vec3 redB    = vec3(0.580, 0.259, 0.169); // 3000m 红棕色
    vec3 white   = vec3(0.980, 0.980, 0.980); // 5000m 纯白

    vec3 col;
    if (elev < 0.2) col = meadow;
    else if (elev < 0.5) col = mix(meadow, brightG, (elev - 0.2) / 0.3);
    else if (elev < 1.5) col = mix(brightG, goldY, (elev - 0.5) / 1.0);
    else if (elev < 3.0) col = mix(goldY, rustO, (elev - 1.5) / 1.5);
    else if (elev < 5.0) col = mix(rustO, redB, (elev - 3.0) / 2.0);
    else col = mix(redB, white, (elev - 5.0) / 3.0);

    vec3 ice = vec3(0.980, 0.980, 0.980);
    float s = snowLine(lat, h);
    col = mix(col, ice, s);
    float p = polarIce(lat);
    col = mix(col, ice, p * (1.0 - h * 0.3));
    vec3 tundra = vec3(0.737, 0.690, 0.608);
    float tm = smoothstep(50.0, 65.0, abs(lat)) * (1.0 - s);
    col = mix(col, tundra, tm * 0.5);

    float steep = smoothstep(0.10, 0.50, slope);
    col = mix(col, col * 0.85, steep * 0.3);
    return col;
  }

  // ---- Land color: climate-driven + latitude snow/ice ----
  vec3 landColor(float h, float slope, vec2 uv) {
    float n = fbm(uv * uResolution * 1.5) * 0.03;
    float lat = uv.y * 180.0 - 90.0;
    float elev = (h - 0.15) * 3.0;

    vec3 meadow  = vec3(0.235, 0.471, 0.220);
    vec3 brightG = vec3(0.482, 0.682, 0.278);
    vec3 goldY   = vec3(0.890, 0.741, 0.341);
    vec3 rustO   = vec3(0.820, 0.420, 0.220);
    vec3 redB    = vec3(0.580, 0.259, 0.169);
    vec3 white   = vec3(0.980, 0.980, 0.980);

    vec3 base;
    if (elev < 0.2) base = meadow;
    else if (elev < 0.5) base = mix(meadow, brightG, (elev - 0.2) / 0.3);
    else if (elev < 1.5) base = mix(brightG, goldY, (elev - 0.5) / 1.0);
    else if (elev < 3.0) base = mix(goldY, rustO, (elev - 1.5) / 1.5);
    else if (elev < 5.0) base = mix(rustO, redB, (elev - 3.0) / 2.0);
    else base = mix(redB, white, (elev - 5.0) / 3.0);

    float precip = 1.0;
    if (uHasClimate > 0.5) precip = texture2D(uPrecipMap, uv).r;

    vec3 forest   = vec3(0.420, 0.557, 0.267);
    vec3 grassland= vec3(0.667, 0.776, 0.541);
    vec3 farmland = vec3(0.722, 0.812, 0.616);
    vec3 desert   = vec3(0.922, 0.851, 0.690);
    vec3 tundraV  = vec3(0.737, 0.690, 0.608);

    vec3 veg;
    if (precip < 0.1) veg = desert;
    else if (precip < 0.3) veg = mix(desert, grassland, (precip - 0.1) / 0.2);
    else if (precip < 0.6) veg = mix(grassland, farmland, (precip - 0.3) / 0.3);
    else veg = mix(farmland, forest, (precip - 0.6) / 0.4);

    float rockT = smoothstep(1.5, 4.0, elev);
    vec3 col = mix(veg, base, rockT);

    vec3 ice = vec3(0.980, 0.980, 0.980);
    float s = snowLine(lat, h);
    col = mix(col, ice, s);
    float p = polarIce(lat);
    col = mix(col, ice, p * (1.0 - h * 0.3));
    float tm = smoothstep(50.0, 65.0, abs(lat)) * (1.0 - s);
    col = mix(col, tundraV, tm * 0.5);

    float steep = smoothstep(0.10, 0.50, slope);
    col = mix(col, col * 0.85, steep * 0.3);
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
        col = oceanColor(h, slope);
      } else if (h < 0.22) {
        col = shoreColor(h, slope, vUv);
      } else {
        // Land with optional climate blend
        vec3 colNoClimate = landColorNoClimate(h, slope, vUv);
        vec3 colClimate = landColor(h, slope, vUv);
        col = mix(colNoClimate, colClimate, uClimateBlend);
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

  const dummyTex = new THREE.DataTexture(new Uint8Array([128]), 1, 1, THREE.RedFormat);
  dummyTex.needsUpdate = true;

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uHeightmap: { value: texture },
      uHeightScale: { value: 4.0 },
      uResolution: { value: HEIGHTMAP_SIZE },
      uContourInterval: { value: 0.04 },
      uContourWidth: { value: 0.3 },
      uViewMode: { value: 0 },
      uPrecipMap: { value: dummyTex },
      uTempMap: { value: dummyTex },
      uHasClimate: { value: 0 },
      uClimateBlend: { value: 0 },
    },
    side: THREE.DoubleSide,
  });

  return { material, texture };
}

export function setClimateTextures(
  material: THREE.ShaderMaterial,
  precipMap: Float32Array | null,
  tempMap: Float32Array | null
): void {
  if (precipMap && tempMap) {
    const pTex = new THREE.DataTexture(precipMap, HEIGHTMAP_SIZE, HEIGHTMAP_SIZE, THREE.RedFormat, THREE.FloatType);
    pTex.needsUpdate = true;
    const tTex = new THREE.DataTexture(tempMap, HEIGHTMAP_SIZE, HEIGHTMAP_SIZE, THREE.RedFormat, THREE.FloatType);
    tTex.needsUpdate = true;

    const oldP = material.uniforms.uPrecipMap.value as THREE.DataTexture;
    const oldT = material.uniforms.uTempMap.value as THREE.DataTexture;
    if (oldP && oldP.image.width > 1) oldP.dispose();
    if (oldT && oldT.image.width > 1) oldT.dispose();

    material.uniforms.uPrecipMap.value = pTex;
    material.uniforms.uTempMap.value = tTex;
    material.uniforms.uHasClimate.value = 1;
  } else {
    material.uniforms.uHasClimate.value = 0;
  }
}
