'use client';

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { WeatherType } from '@/types/orihour';

interface RainyWindowGlassProps {
  weather: WeatherType;
  onCycleWeather: () => void;
  onHoverLabel: (label: string | null) => void;
}

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Procedural high-precision window glass + realistic micro-raindrops & sliding rivulets shader
const FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uRainMix;
  uniform float uSheenStrength;
  varying vec2 vUv;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  // Sliding rain rivulet layer (returns vec3: x = drop/trail alpha, y = specular highlight, z = shadow rim)
  vec3 slidingDrops(vec2 uv, float t, vec2 grid, float speed) {
    vec2 aspect = vec2(2.94, 1.68);
    vec2 p = uv * aspect;
    vec2 gv = p * grid;

    float colId = floor(gv.x);
    float colOffset = hash21(vec2(colId, grid.x * 3.17)) * 18.0;
    // Increasing gv.y over time moves the drops smoothly downward on screen
    gv.y += t * speed + colOffset;

    vec2 id = floor(gv);
    vec2 f = fract(gv) - 0.5;

    float rnd = hash21(id + vec2(grid.x * 11.3, grid.y * 5.7));
    if (rnd < 0.38) return vec3(0.0);

    // Subtle organic horizontal wander along the glass
    float wobblePhase = p.y * 16.0 + rnd * 6.2831;
    float x = (rnd - 0.5) * 0.52 + sin(wobblePhase) * pow(sin(wobblePhase * 0.5), 2.0) * 0.09;

    // Natural stick-slip gravity glide inside each cell
    float cycle = t * (0.9 + rnd * 0.5) + rnd * 6.2831;
    float y = -sin(cycle + sin(cycle + sin(cycle) * 0.45) * 0.55) * 0.34;

    // Tear-shaped main droplet (slightly elongated vertically)
    vec2 d = (f - vec2(x, y)) * vec2(1.0, 1.85);
    float dist = length(d);
    float radius = 0.068 + rnd * 0.032;
    float dropBody = smoothstep(radius, radius * 0.42, dist);

    // Subtle wet micro-trail beads left directly above the sliding drop
    float above = smoothstep(y - 0.01, y + 0.035, f.y);
    float topFade = 1.0 - smoothstep(y + 0.05, 0.47, f.y);
    float beadCellY = (fract(f.y * 6.5 + rnd * 3.0) - 0.5) * 0.36;
    float trailDist = length(vec2((f.x - x) * 1.45, beadCellY));
    float trailBeads = smoothstep(0.048, 0.015, trailDist) * above * topFade;

    // Hairline wet streak connecting beads
    float wetTrack = smoothstep(0.022, 0.004, abs(f.x - x)) * above * topFade * 0.24;

    // Realistic tiny specular catchlight on bottom-left of droplet & dark upper refraction rim
    float spec = smoothstep(radius * 0.62, radius * 0.12, length(d - vec2(-radius * 0.22, -radius * 0.28))) * dropBody;
    float rimShadow = smoothstep(radius * 0.95, radius * 0.48, length(d - vec2(radius * 0.16, radius * 0.26))) * dropBody;

    float alpha = max(dropBody, max(trailBeads * 0.65, wetTrack));
    return vec3(alpha, spec + trailBeads * 0.28, rimShadow);
  }

  // Fine static micro-droplets clinging across the windowpane
  vec2 staticMicroDrops(vec2 uv, float t, vec2 grid) {
    vec2 aspect = vec2(2.94, 1.68);
    vec2 gv = uv * aspect * grid;
    vec2 id = floor(gv);
    vec2 f = fract(gv) - 0.5;

    float n1 = hash21(id + grid);
    float n2 = hash21(id * 2.13 + vec2(19.7, 3.1));
    if (n1 < 0.42) return vec2(0.0);

    vec2 offset = (vec2(n1, n2) - 0.5) * 0.58;
    float r = 0.06 + fract(n1 * 17.3) * 0.085;

    // Very gentle shimmer as new micro-beads condense
    float pulse = 0.72 + 0.28 * sin(t * 0.45 + n2 * 6.2831);
    vec2 d = f - offset;
    float body = smoothstep(r, r * 0.45, length(d)) * pulse;
    float spec = smoothstep(r * 0.55, r * 0.1, length(d - vec2(-r * 0.25, -r * 0.25))) * body;
    return vec2(body, spec);
  }

  void main() {
    // 4-pane architectural glass sheen (distinct reflection inside each quadrant)
    vec2 paneUv = fract(vUv * 2.0);
    vec2 edgeDist = min(paneUv, 1.0 - paneUv);
    float edgeHighlight = (1.0 - smoothstep(0.0, 0.022, min(edgeDist.x, edgeDist.y))) * 0.14;

    // Subtle soft diagonal daylight window reflection
    float diag = paneUv.x * 0.72 + paneUv.y * 0.68;
    float band1 = exp(-pow((diag - 0.46) * 8.5, 2.0)) * 0.13;
    float band2 = exp(-pow((diag - 0.66) * 14.0, 2.0)) * 0.075;
    float cornerSheen = smoothstep(0.85, 0.05, length(paneUv - vec2(0.15, 0.85))) * 0.065;

    float glassReflection = (band1 + band2 + cornerSheen + edgeHighlight) * uSheenStrength;
    vec3 glassColor = vec3(0.88, 0.94, 0.99);
    float glassAlpha = 0.055 * uSheenStrength + glassReflection;

    // Rain condensation & multi-scale droplet simulation
    vec3 col = glassColor;
    float alpha = glassAlpha;

    if (uRainMix > 0.005) {
      // Subtle cool mist condensation around pane perimeter
      float mistEdge = 1.0 - smoothstep(0.0, 0.26, min(edgeDist.x, edgeDist.y));
      float baseMist = (0.045 + mistEdge * 0.095) * uRainMix;

      vec3 bigSlides = slidingDrops(vUv, uTime, vec2(8.5, 2.2), 0.36);
      vec3 midSlides = slidingDrops(vUv + vec2(0.37, 0.19), uTime * 1.12, vec2(14.5, 3.6), 0.52);
      vec2 micro1 = staticMicroDrops(vUv, uTime, vec2(28.0, 18.0));
      vec2 micro2 = staticMicroDrops(vUv + vec2(0.13, 0.41), uTime * 0.8, vec2(48.0, 32.0));

      float dropMask = clamp(
        bigSlides.x * 0.78 +
        midSlides.x * 0.55 +
        micro1.x * 0.34 +
        micro2.x * 0.22,
        0.0,
        1.0
      );

      float specHighlight = clamp(
        bigSlides.y * 0.95 +
        midSlides.y * 0.7 +
        micro1.y * 0.45 +
        micro2.y * 0.3,
        0.0,
        1.0
      );

      float rimDark = clamp(bigSlides.z * 0.5 + midSlides.z * 0.35, 0.0, 1.0);

      // Droplets catch subtle sky/room specular highlights and gentle dark refracted rims
      vec3 rainColor = mix(vec3(0.76, 0.84, 0.92), vec3(0.24, 0.30, 0.38), rimDark * 0.55);
      rainColor = mix(rainColor, vec3(0.98, 0.99, 1.0), specHighlight * 0.82);

      float rainAlpha = (baseMist + dropMask * 0.34 + specHighlight * 0.38) * uRainMix;
      col = mix(col, rainColor, clamp(rainAlpha * 1.8, 0.0, 0.92));
      alpha = clamp(alpha * (1.0 - uRainMix * 0.35) + rainAlpha, 0.0, 0.72);
    }

    gl_FragColor = vec4(col, alpha);
  }
`;

export default function RainyWindowGlass({
  weather,
  onCycleWeather,
  onHoverLabel,
}: RainyWindowGlassProps) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const rainMixRef = useRef(weather === 'RAIN' ? 1 : 0);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uRainMix: { value: weather === 'RAIN' ? 1 : 0 },
      uSheenStrength: { value: 1.0 },
    }),
    []
  );

  useFrame(({ clock }, delta) => {
    if (!matRef.current) return;
    const dt = Math.min(delta, 0.05);
    const targetRain = weather === 'RAIN' ? 1.0 : 0.0;
    rainMixRef.current += (targetRain - rainMixRef.current) * Math.min(1, dt * 3.5);

    const targetSheen =
      weather === 'RAIN'
        ? 0.58
        : weather === 'CLOUDY'
        ? 0.95
        : weather === 'BREEZY'
        ? 1.05
        : 1.15;

    matRef.current.uniforms.uTime.value = clock.getElapsedTime();
    matRef.current.uniforms.uRainMix.value = rainMixRef.current;
    matRef.current.uniforms.uSheenStrength.value +=
      (targetSheen - matRef.current.uniforms.uSheenStrength.value) * Math.min(1, dt * 4.0);
  });

  return (
    <group position={[-0.15, 2.45, -1.24]}>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onCycleWeather();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
          onHoverLabel(`Window (${weather}): Click to Cycle Weather`);
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto';
          onHoverLabel(null);
        }}
      >
        <planeGeometry args={[2.94, 1.68]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={VERTEX_SHADER}
          fragmentShader={FRAGMENT_SHADER}
          uniforms={uniforms}
          transparent
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}