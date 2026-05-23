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

  // ---- Bathymetric tint (professional cartographic) ----
  vec3 oceanColor(float h, float slope) {
    // h: 0.00=deepest trench, 0.15=sea level
    // Normalized depth: 1.0=deepest, 0.0=surface
    float d = 1.0 - h / 0.15;
    d = clamp(d, 0.0, 1.0);

    vec3 trench  = vec3(0.024, 0.102, 0.200);   // 6000m+ 墨黑蓝 #061A33
    vec3 abyss   = vec3(0.051, 0.231, 0.400);   // 3000m 午夜蓝 #0D3B66
    vec3 deep    = vec3(0.102, 0.361, 0.600);   // 1000m 深蓝 #1A5C99
    vec3 mid     = vec3(0.227, 0.522, 0.800);   // 200m 深海蓝 #3A85CC
    vec3 ocean   = vec3(0.420, 0.710, 1.000);   // 50m 标准蓝 #6BB5FF
    vec3 shallow = vec3(0.659, 0.847, 1.000);   // 20m 浅蓝 #A8D8FF
    vec3 reef    = vec3(0.847, 0.941, 1.000);   // 0m 极浅蓝 #D8F0FF

    vec3 col;
    if (d > 0.85) col = mix(abyss, trench, (d - 0.85) / 0.15);
    else if (d > 0.65) col = mix(deep, abyss, (d - 0.65) / 0.20);
    else if (d > 0.45) col = mix(mid, deep, (d - 0.45) / 0.20);
    else if (d > 0.25) col = mix(ocean, mid, (d - 0.25) / 0.20);
    else if (d > 0.10) col = mix(shallow, ocean, (d - 0.10) / 0.15);
    else col = mix(reef, shallow, d / 0.10);

    float n = fbm(vUv * uResolution * 0.5) * 0.02;
    return col + n;
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

  // ---- Hypsometric tint (professional cartographic) ----
  vec3 landColorNoClimate(float h, float slope, vec2 uv) {
    float n = fbm(uv * uResolution * 1.5) * 0.03;
    float lat = uv.y * 180.0 - 90.0;

    // h normalized to 0-10km for hypsometric bands
    float elev = (h - 0.15) * 3.0; // km above sea level

    vec3 lowGreen  = vec3(0.298, 0.549, 0.227);  // 0-200m  #4C8C3A
    vec3 plainGreen= vec3(0.486, 0.694, 0.369);  // 200-500m #7CB15E
    vec3 hillGreen = vec3(0.667, 0.820, 0.667);  // 500-1km #AAD1AA
    vec3 highGreen = vec3(0.824, 0.875, 0.620);  // 1-1.5km #D2DF9E
    vec3 brownLow  = vec3(0.898, 0.761, 0.494);  // 1.5-2.5k #E5C27E
    vec3 brownMid  = vec3(0.788, 0.627, 0.416);  // 2.5-3.5k #C9A06A
    vec3 greyBrown = vec3(0.690, 0.627, 0.596);  // 3.5-5km #B0A098
    vec3 greyHigh  = vec3(0.851, 0.851, 0.851);  // 5-8km   #D9D9D9
    vec3 white     = vec3(1.000, 1.000, 1.000);  // 8km+    #FFFFFF

    vec3 col;
    if (elev < 0.2) col = mix(lowGreen, plainGreen, elev / 0.2);
    else if (elev < 0.5) col = mix(plainGreen, hillGreen, (elev - 0.2) / 0.3);
    else if (elev < 1.0) col = mix(hillGreen, highGreen, (elev - 0.5) / 0.5);
    else if (elev < 1.5) col = mix(highGreen, brownLow, (elev - 1.0) / 0.5);
    else if (elev < 2.5) col = mix(brownLow, brownMid, (elev - 1.5) / 1.0);
    else if (elev < 4.0) col = mix(brownMid, greyBrown, (elev - 2.5) / 1.5);
    else if (elev < 6.0) col = mix(greyBrown, greyHigh, (elev - 4.0) / 2.0);
    else col = vec3(1.0, 1.0, 1.0);

    // Latitude snow/ice override
    vec3 ice = vec3(0.90, 0.92, 0.95);
    float s = snowLine(lat, h);
    col = mix(col, ice, s);
    float p = polarIce(lat);
    col = mix(col, ice, p * (1.0 - h * 0.3));
    float tm = smoothstep(50.0, 65.0, abs(lat)) * (1.0 - s);
    vec3 tundra = vec3(0.55, 0.58, 0.52);
    col = mix(col, tundra, tm * 0.4);

    float steep = smoothstep(0.10, 0.50, slope);
    col = mix(col, greyBrown * 0.9, steep * 0.5);
    col += n;
    return col;
  }

  // ---- Land color: climate-driven + latitude snow/ice ----
  vec3 landColor(float h, float slope, vec2 uv) {
    float n = fbm(uv * uResolution * 1.5) * 0.03;
    float lat = uv.y * 180.0 - 90.0;
    float elev = h * 10.0;

    // Hypsometric base
    vec3 lowGreen  = vec3(0.298, 0.549, 0.227);
    vec3 plainGreen= vec3(0.486, 0.694, 0.369);
    vec3 hillGreen = vec3(0.667, 0.820, 0.667);
    vec3 highGreen = vec3(0.824, 0.875, 0.620);
    vec3 brownLow  = vec3(0.898, 0.761, 0.494);
    vec3 brownMid  = vec3(0.788, 0.627, 0.416);
    vec3 greyBrown = vec3(0.690, 0.627, 0.596);
    vec3 greyHigh  = vec3(0.851, 0.851, 0.851);

    vec3 base;
    if (elev < 0.2) base = mix(lowGreen, plainGreen, elev / 0.2);
    else if (elev < 0.5) base = mix(plainGreen, hillGreen, (elev - 0.2) / 0.3);
    else if (elev < 1.0) base = mix(hillGreen, highGreen, (elev - 0.5) / 0.5);
    else if (elev < 1.5) base = mix(highGreen, brownLow, (elev - 1.0) / 0.5);
    else if (elev < 2.5) base = mix(brownLow, brownMid, (elev - 1.5) / 1.0);
    else if (elev < 4.0) base = mix(brownMid, greyBrown, (elev - 2.5) / 1.5);
    else if (elev < 6.0) base = mix(greyBrown, greyHigh, (elev - 4.0) / 2.0);
    else base = vec3(1.0, 1.0, 1.0);

    // Vegetation density from precipitation
    float precip = 1.0;
    if (uHasClimate > 0.5) precip = texture2D(uPrecipMap, uv).r;

    vec3 desert  = vec3(0.949, 0.890, 0.776);
    vec3 steppe  = vec3(0.851, 0.878, 0.651);
    vec3 shrub   = vec3(0.702, 0.804, 0.541);
    vec3 woodland= vec3(0.537, 0.690, 0.384);
    vec3 forest  = vec3(0.353, 0.561, 0.278);
    vec3 jungle  = vec3(0.173, 0.369, 0.180);

    vec3 veg;
    if (precip < 0.1) veg = mix(desert, steppe, precip / 0.1);
    else if (precip < 0.3) veg = mix(steppe, shrub, (precip - 0.1) / 0.2);
    else if (precip < 0.5) veg = mix(shrub, woodland, (precip - 0.3) / 0.2);
    else if (precip < 0.7) veg = mix(woodland, forest, (precip - 0.5) / 0.2);
    else if (precip < 0.9) veg = mix(forest, jungle, (precip - 0.7) / 0.2);
    else veg = jungle;

    float rockT = smoothstep(1.5, 3.0, elev);
    vec3 col = mix(veg, base, rockT);

    vec3 ice = vec3(0.90, 0.92, 0.95);
    vec3 white = vec3(1.0, 1.0, 1.0);
    float s = snowLine(lat, h);
    col = mix(col, elev > 7.0 ? white : ice, s);
    float p = polarIce(lat);
    col = mix(col, ice, p * (1.0 - h * 0.3));
    float tm = smoothstep(50.0, 65.0, abs(lat)) * (1.0 - s);
    vec3 tundra = vec3(0.55, 0.58, 0.52);
    col = mix(col, tundra, tm * 0.4);

    float steep = smoothstep(0.10, 0.50, slope);
    col = mix(col, greyBrown * 0.9, steep * 0.5);
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
      uHeightScale: { value: 2.0 },
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
