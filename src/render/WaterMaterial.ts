import * as THREE from "three";

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vInstancePos;

  void main() {
    vUv = uv;
    vec4 worldPos = instanceMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vInstancePos = vec3(instanceMatrix[3].x, instanceMatrix[3].y, instanceMatrix[3].z);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const riverFragment = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vInstancePos;
  uniform float uTime;

  // Hash for variation
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec2 pos = vInstancePos.xy * 50.0;

    // Flow lines — moving along Y (downstream)
    float flow = fract(pos.y * 0.8 - uTime * 0.3 + hash(floor(pos)) * 0.5);
    flow = smoothstep(0.0, 0.15, flow) * smoothstep(0.5, 0.35, flow);

    // Ripple rings
    float ripple = sin(length(pos) * 3.0 - uTime * 2.0) * 0.5 + 0.5;
    ripple *= 0.3;

    // Specular highlights moving diagonally
    float spec = sin((pos.x + pos.y) * 2.0 - uTime * 1.5) * 0.5 + 0.5;
    spec = smoothstep(0.6, 0.9, spec) * 0.4;

      // 标准水色 #8ABAE0 / 深湖蓝 #5983A6
    vec3 deepBlue = vec3(0.349, 0.514, 0.651);
    vec3 brightBlue = vec3(0.541, 0.729, 0.878);
    float brightness = 0.5 + flow * 0.3 + ripple + spec;

    vec3 color = mix(deepBlue, brightBlue, brightness);
    gl_FragColor = vec4(color, 0.85);
  }
`;

const lakeFragment = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vInstancePos;
  uniform float uTime;

  void main() {
    vec2 pos = vInstancePos.xy * 40.0;
    float dist = length(pos);

    // Concentric ripples from center
    float ripple = sin(dist * 4.0 - uTime * 1.8) * 0.5 + 0.5;
    ripple = smoothstep(0.45, 0.55, ripple) * 0.25;

    // Slow large waves
    float wave = sin(pos.x * 1.5 + uTime * 0.5) * sin(pos.y * 2.0 + uTime * 0.7);
    wave = wave * 0.15 + 0.5;

    // Wind streaks
    float wind = sin(pos.y * 3.0 + uTime * 0.4 + sin(pos.x * 1.2) * 2.0);
    wind = smoothstep(0.3, 0.7, wind * 0.5 + 0.5) * 0.2;

    // Shore shallow = lighter
    float shore = smoothstep(0.0, 0.5, dist) * 0.15;

    vec3 deep = vec3(0.349, 0.514, 0.651);    // #5983A6
    vec3 shallow = vec3(0.541, 0.729, 0.878);  // #8ABAE0
    float mixVal = 0.4 + ripple + wave + wind + shore;

    vec3 color = mix(deep, shallow, clamp(mixVal, 0.0, 1.0));
    gl_FragColor = vec4(color, 0.9);
  }
`;

export function createRiverMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader: riverFragment,
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

export function createLakeMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader: lakeFragment,
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}
