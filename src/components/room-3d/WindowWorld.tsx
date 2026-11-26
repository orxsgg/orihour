'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AtmosphereState } from '@/lib/timeAtmosphere';
import { WeatherType } from '@/types/orihour';
import {
  createBarkPbr,
  createCloudTexture,
  createDriftingLeafTexture,
  createGrassClumpTexture,
  createLeafSprigTexture,
  createMeadowPbr,
  createMoonTexture,
  createSoftShadowTexture,
  createSunTexture,
} from './textures';

interface WindowWorldProps {
  atmosphere: AtmosphereState;
  weather: WeatherType;
  hourDecimal: number;
}

function hash01(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

// Quintic C2-continuous smootherstep (eliminates Mach-band crease lines across sunlit hills!)
function smootherstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

// Infinitely smooth C2 continuous 3D meadow & rolling hills (ZERO Math.min kinks or ridge lines!)
function getTerrainHeight(x: number, z: number): number {
  const dist = Math.max(0, -z - 2.4);

  // Smooth exponential slope with continuous derivatives everywhere
  const meadowMask = smootherstep(0.0, 6.5, dist);
  const meadowSlope = 26.0 * (1.0 - Math.exp(-dist / 26.0)) * 0.036;
  const meadowWaves =
    (Math.sin(x * 0.1 + 0.5) * Math.cos(z * 0.085) * 0.24 +
      Math.sin(x * 0.2 - z * 0.14) * 0.08) *
    meadowMask;

  // Seamless rolling background hills with smooth quintic transition
  const hillMask = smootherstep(14.0, 56.0, dist);
  const centralValley = 1.0 - Math.exp(-Math.pow((x - 0.5) / 17.5, 2)) * 0.38;
  const ridgePrimary =
    (Math.sin(x * 0.055 + 0.8) * 0.5 +
      Math.cos(x * 0.029 - 1.0) * 0.5 +
      1.0) *
    2.35;
  const ridgeDetail =
    (Math.sin(x * 0.105 + z * 0.036 + 2.1) * 0.4 +
      Math.cos(x * 0.072 - z * 0.042) * 0.3 +
      0.55) *
    0.75;

  const distantRidge =
    smootherstep(28.0, 58.0, dist) * (1.45 + Math.sin(x * 0.04 + 1.6) * 0.72);

  return (
    -0.24 +
    meadowSlope +
    meadowWaves +
    (ridgePrimary * centralValley + ridgeDetail) * hillMask +
    distantRidge
  );
}

// Atmospheric Sky Dome with smooth Rayleigh/Mie horizon scattering
function SkyDome({ atmosphere }: { atmosphere: AtmosphereState }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color(atmosphere.skyTop) },
      uBottom: { value: new THREE.Color(atmosphere.skyBottom) },
      uHorizon: { value: new THREE.Color(atmosphere.skyHorizon) },
      uSunDir: { value: new THREE.Vector3(0, 0.2, -1).normalize() },
      uSunColor: { value: new THREE.Color(atmosphere.sunColor) },
      uSunGlow: { value: atmosphere.sunOpacity },
    }),
    []
  );

  useFrame(() => {
    if (!matRef.current) return;
    matRef.current.uniforms.uTop.value.set(atmosphere.skyTop);
    matRef.current.uniforms.uBottom.value.set(atmosphere.skyBottom);
    matRef.current.uniforms.uHorizon.value.set(atmosphere.skyHorizon);
    matRef.current.uniforms.uSunColor.value.set(atmosphere.sunColor);
    matRef.current.uniforms.uSunGlow.value = atmosphere.sunOpacity;

    const [sx, sy, sz] = atmosphere.sunPosition;
    matRef.current.uniforms.uSunDir.value.set(sx, sy - 2.0, sz).normalize();
  });

  return (
    <mesh position={[0, 2, -14]} scale={[86, 62, 86]}>
      <sphereGeometry args={[1, 40, 28]} />
      <shaderMaterial
        ref={matRef}
        side={THREE.BackSide}
        depthWrite={false}
        fog={false}
        uniforms={uniforms}
        vertexShader={`
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 uTop;
          uniform vec3 uBottom;
          uniform vec3 uHorizon;
          uniform vec3 uSunDir;
          uniform vec3 uSunColor;
          uniform float uSunGlow;
          varying vec3 vDir;

          void main() {
            vec3 dir = normalize(vDir);
            float h = clamp(dir.y, -0.1, 1.0);

            vec3 lower = mix(uHorizon, uBottom, smoothstep(0.0, 0.16, max(0.0, h)));
            vec3 col = mix(lower, uTop, smoothstep(0.12, 0.72, max(0.0, h)));

            float sunDot = max(0.0, dot(dir, normalize(uSunDir)));
            float wideGlow = pow(sunDot, 5.0) * 0.24 * uSunGlow;
            float tightGlow = pow(sunDot, 28.0) * 0.24 * uSunGlow;
            float horizonBand = exp(-abs(h - 0.04) * 14.0) * 0.11 * uSunGlow;

            col += uSunColor * (wideGlow + tightGlow + horizonBand);
            gl_FragColor = vec4(col, 1.0);
          }
        `}
      />
    </mesh>
  );
}

// Natural Circular Twinkling Starfield
function Starfield({ opacity }: { opacity: number }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const geo = useMemo(() => {
    const count = 340;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const colors = new Float32Array(count * 3);

    const starPalette = [
      new THREE.Color('#FFFDF6'),
      new THREE.Color('#DCEBFF'),
      new THREE.Color('#FFE9C8'),
      new THREE.Color('#C8DEFF'),
    ];

    for (let i = 0; i < count; i++) {
      const r1 = hash01(i * 2.13 + 1.1);
      const r2 = hash01(i * 4.71 + 3.7);
      const r3 = hash01(i * 7.39 + 5.9);
      const r4 = hash01(i * 11.17 + 2.3);

      positions[i * 3] = (r1 - 0.5) * 78;
      positions[i * 3 + 1] = 5.4 + Math.pow(r2, 0.85) * 23;
      positions[i * 3 + 2] = -62 - r3 * 12;

      sizes[i] = r4 > 0.88 ? 4.4 + r3 * 2.4 : 1.8 + r4 * 2.2;
      phases[i] = r1 * 6.2831 + r3 * 12.0;

      const c = starPalette[i % starPalette.length];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    return g;
  }, []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOpacity: { value: opacity },
    }),
    []
  );

  useFrame(({ clock }) => {
    if (!matRef.current) return;
    matRef.current.uniforms.uTime.value = clock.getElapsedTime();
    matRef.current.uniforms.uOpacity.value = opacity;
  });

  if (opacity <= 0.02) return null;

  return (
    <points geometry={geo}>
      <shaderMaterial
        ref={matRef}
        transparent
        depthWrite={false}
        fog={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={`
          attribute float aSize;
          attribute float aPhase;
          attribute vec3 aColor;
          uniform float uTime;
          varying vec3 vColor;
          varying float vTwinkle;
          void main() {
            vColor = aColor;
            vTwinkle = 0.62 + 0.38 * sin(uTime * (1.2 + fract(aPhase) * 2.2) + aPhase);
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = aSize * (1.0 + 0.15 * vTwinkle);
            gl_Position = projectionMatrix * mvPosition;
          }
        `}
        fragmentShader={`
          uniform float uOpacity;
          varying vec3 vColor;
          varying float vTwinkle;
          void main() {
            float d = length(gl_PointCoord - vec2(0.5));
            if (d > 0.5) discard;
            float core = smoothstep(0.5, 0.04, d);
            float alpha = pow(core, 1.75) * vTwinkle * uOpacity * 0.92;
            gl_FragColor = vec4(vColor, alpha);
          }
        `}
      />
    </points>
  );
}

// Energy-Conserving Foliage Shader Matched Strictly to Meadow & Hill PBR Tone (No neon daylight blow-out!)
const FOLIAGE_VERT = /* glsl */ `
  attribute vec3 aCrownNorm;
  attribute float aAO;
  attribute float aPhase;

  uniform float uTime;
  uniform float uWindStrength;
  uniform float uWindSpeed;

  varying vec2 vUv;
  varying vec3 vCrownNorm;
  varying float vAO;
  varying vec3 vWorldPos;
  varying float vFogDepth;

  void main() {
    vUv = uv;
    vAO = aAO;

    vec3 localPos = position;
    float flutter = sin(uTime * uWindSpeed + aPhase + localPos.y * 2.5) * uWindStrength * (0.4 + 0.6 * aAO);
    float gust = cos(uTime * uWindSpeed * 0.68 + aPhase * 1.4) * uWindStrength * 0.55;
    localPos.x += flutter;
    localPos.z += gust;

    vec4 worldPosition = modelMatrix * instanceMatrix * vec4(localPos, 1.0);
    vWorldPos = worldPosition.xyz;
    vCrownNorm = normalize(mat3(modelMatrix) * aCrownNorm);

    vec4 mvPos = viewMatrix * worldPosition;
    vFogDepth = -mvPos.z;
    gl_Position = projectionMatrix * mvPos;
  }
`;

const FOLIAGE_FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uSunIntensity;
  uniform vec3 uHemiSky;
  uniform vec3 uHemiGround;
  uniform float uHemiIntensity;
  uniform vec3 uFoliageTint;
  uniform vec3 uFogColor;
  uniform float uFogDensity;

  varying vec2 vUv;
  varying vec3 vCrownNorm;
  varying float vAO;
  varying vec3 vWorldPos;
  varying float vFogDepth;

  const float INV_PI = 0.31830988618;

  void main() {
    vec4 tex = texture2D(uMap, vUv);
    if (tex.a < 0.42) discard;

    // Ground the leaf chroma into the exact warm olive-meadow tone of the grass & hills
    float luma = dot(tex.rgb, vec3(0.2126, 0.7152, 0.0722));
    vec3 mutedLeaf = mix(vec3(luma), tex.rgb, 0.72) * uFoliageTint;

    vec3 N = normalize(vCrownNorm);
    vec3 L = normalize(uSunDir);
    vec3 V = normalize(cameraPosition - vWorldPos);

    // Physically calibrated Lambertian / PI wrap diffuse matching MeshStandardMaterial on hills & grass
    float wrapDiff = clamp((dot(N, L) + 0.55) / 1.55, 0.0, 1.0);
    vec3 directLight = uSunColor * wrapDiff * (uSunIntensity * INV_PI);

    // Subtle organic backlit warmth through outer leaves (zero radioactive chartreuse glow!)
    float backDot = pow(clamp(dot(V, -L), 0.0, 1.0), 2.5);
    float rim = pow(1.0 - abs(dot(N, V)), 2.0);
    vec3 translucency = uSunColor * vec3(0.74, 0.80, 0.48) * (backDot * 0.24 + rim * 0.08) * (uSunIntensity * INV_PI) * (0.3 + 0.7 * vAO);

    // Hemisphere ambient lighting matched to OrihourCanvas hemisphereLight
    float hemiMix = N.y * 0.5 + 0.5;
    vec3 hemiLight = mix(uHemiGround, uHemiSky, hemiMix) * (uHemiIntensity * INV_PI) * 1.15;

    // Gentle volumetric self-shadowing (deep calm forest interior -> sunlit olive crown top)
    float aoCurve = mix(0.46, 0.98, vAO);
    vec3 litColor = mutedLeaf * (hemiLight + directLight) * aoCurve + mutedLeaf * translucency;

    // Exact scene fogExp2 atmospheric depth blend
    float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * vFogDepth * vFogDepth);
    vec3 finalCol = mix(litColor, uFogColor, clamp(fogFactor, 0.0, 1.0));

    gl_FragColor = vec4(finalCol, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// Sculpted Deciduous Tree with Cohesive Weathered Bark & PBR-Matched Olive Foliage Crown
function NaturalMeadowTree({
  x,
  z,
  scale = 1,
  seed = 1,
  weather,
  atmosphere,
  bark,
  leafTex,
  shadowTex,
  landscapeTint,
  barkTint,
}: {
  x: number;
  z: number;
  scale?: number;
  seed?: number;
  weather: WeatherType;
  atmosphere: AtmosphereState;
  bark: ReturnType<typeof createBarkPbr>;
  leafTex: THREE.CanvasTexture;
  shadowTex: THREE.CanvasTexture;
  landscapeTint: string;
  barkTint: string;
}) {
  const crownRef = useRef<THREE.Group>(null);
  const foliageMeshRef = useRef<THREE.InstancedMesh>(null);
  const foliageMatRef = useRef<THREE.ShaderMaterial>(null);
  const baseY = useMemo(() => getTerrainHeight(x, z) - 0.1, [x, z]);

  const { trunkGeo, branches, foliageGeo, clusterMatrices } = useMemo(() => {
    const leanX = (hash01(seed * 2.1) - 0.5) * 0.22;
    const leanZ = (hash01(seed * 3.7) - 0.5) * 0.18;

    const trunkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(leanX * 0.35, 1.0, leanZ * 0.35),
      new THREE.Vector3(leanX * 0.85, 2.1, leanZ * 0.6),
      new THREE.Vector3(leanX * 0.55, 3.15, leanZ * 0.4),
    ]);
    const tGeo = new THREE.TubeGeometry(trunkCurve, 14, 0.21, 10, false);
    const pos = tGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const py = pos.getY(i);
      const t = Math.max(0, Math.min(1, py / 3.15));
      const rootFlare = py < 0.65 ? 1.0 + Math.pow(1 - py / 0.65, 2) * 0.65 : 1.0;
      const taper = (1.02 - t * 0.6) * rootFlare;
      const center = trunkCurve.getPoint(t);
      pos.setX(i, center.x + (pos.getX(i) - center.x) * taper);
      pos.setZ(i, center.z + (pos.getZ(i) - center.z) * taper);
    }
    tGeo.computeVertexNormals();

    const boughSpecs = [
      { startY: 2.05, dx: -1.18, dy: 0.95, dz: 0.24, r: 0.088 },
      { startY: 2.18, dx: 1.12, dy: 0.9, dz: -0.2, r: 0.084 },
      { startY: 2.38, dx: -0.58, dy: 1.12, dz: -0.9, r: 0.074 },
      { startY: 2.48, dx: 0.64, dy: 1.08, dz: 0.85, r: 0.072 },
      { startY: 2.8, dx: -0.14, dy: 1.15, dz: 0.08, r: 0.068 },
    ];

    const branchGeos: THREE.TubeGeometry[] = boughSpecs.map((b, idx) => {
      const c0 = trunkCurve.getPoint(Math.min(0.95, b.startY / 3.15));
      const mid = new THREE.Vector3(
        c0.x + b.dx * 0.5,
        c0.y + b.dy * 0.62,
        c0.z + b.dz * 0.5
      );
      const end = new THREE.Vector3(
        c0.x + b.dx * (0.9 + hash01(seed + idx * 4.1) * 0.14),
        c0.y + b.dy,
        c0.z + b.dz * (0.9 + hash01(seed + idx * 6.3) * 0.14)
      );
      const curve = new THREE.CatmullRomCurve3([c0, mid, end]);
      const segs = 8;
      const radSegs = 6;
      const bGeo = new THREE.TubeGeometry(curve, segs, b.r, radSegs, false);
      const bp = bGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < bp.count; i++) {
        const ringIdx = Math.floor(i / (radSegs + 1));
        const bt = Math.min(1, ringIdx / segs);
        const sR = 1.0 - bt * 0.62;
        const pt = curve.getPoint(bt);
        bp.setXYZ(
          i,
          pt.x + (bp.getX(i) - pt.x) * sR,
          pt.y + (bp.getY(i) - pt.y) * sR,
          pt.z + (bp.getZ(i) - pt.z) * sR
        );
      }
      bGeo.computeVertexNormals();
      return bGeo;
    });

    const crownLobes = [
      { pos: new THREE.Vector3(leanX * 0.55, 3.85, leanZ * 0.4), rx: 1.48, ry: 1.05, rz: 1.38 },
      { pos: new THREE.Vector3(-1.18, 3.35, 0.25), rx: 1.18, ry: 0.86, rz: 1.08 },
      { pos: new THREE.Vector3(1.16, 3.28, -0.22), rx: 1.15, ry: 0.84, rz: 1.06 },
      { pos: new THREE.Vector3(-0.55, 3.55, -0.95), rx: 1.06, ry: 0.82, rz: 1.04 },
      { pos: new THREE.Vector3(0.62, 3.52, 0.9), rx: 1.04, ry: 0.82, rz: 1.02 },
      { pos: new THREE.Vector3(-0.22, 4.65, -0.08), rx: 1.16, ry: 0.86, rz: 1.08 },
      { pos: new THREE.Vector3(0.45, 4.42, 0.22), rx: 0.98, ry: 0.78, rz: 0.96 },
    ];
    const crownCenter = new THREE.Vector3(leanX * 0.5, 3.65, leanZ * 0.35);

    const p1 = new THREE.PlaneGeometry(1, 1);
    const p2 = new THREE.PlaneGeometry(1, 1);
    p2.rotateY(Math.PI * 0.47);
    p2.rotateX(0.22);

    const pos1 = p1.attributes.position.array as Float32Array;
    const pos2 = p2.attributes.position.array as Float32Array;
    const uv1 = p1.attributes.uv.array as Float32Array;
    const uv2 = p2.attributes.uv.array as Float32Array;

    const mergedPos = new Float32Array(pos1.length + pos2.length);
    mergedPos.set(pos1, 0);
    mergedPos.set(pos2, pos1.length);

    const mergedUv = new Float32Array(uv1.length + uv2.length);
    mergedUv.set(uv1, 0);
    mergedUv.set(uv2, uv1.length);

    const idx1 = Array.from(p1.index!.array);
    const vOff = p1.attributes.position.count;
    const idx2 = Array.from(p2.index!.array).map((v) => v + vOff);

    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(mergedPos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(mergedUv, 2));
    geo.setIndex([...idx1, ...idx2]);

    const totalClusters = 220;
    const matrices: THREE.Matrix4[] = [];
    const crownNorms = new Float32Array(totalClusters * 3);
    const aoValues = new Float32Array(totalClusters);
    const phases = new Float32Array(totalClusters);

    const dummyObj = new THREE.Object3D();
    const tmpPos = new THREE.Vector3();
    const tmpNorm = new THREE.Vector3();

    for (let i = 0; i < totalClusters; i++) {
      const lobe = crownLobes[i % crownLobes.length];
      const isInnerCore = i < 65;

      const r1 = hash01(seed * 17 + i * 2.31);
      const r2 = hash01(seed * 29 + i * 4.17);
      const r3 = hash01(seed * 41 + i * 6.83);
      const r4 = hash01(seed * 53 + i * 8.11);

      const theta = r1 * Math.PI * 2;
      const cosPhi = r2 * 2.0 - 1.0;
      const sinPhi = Math.sqrt(Math.max(0, 1.0 - cosPhi * cosPhi));
      const radFactor = isInnerCore ? 0.15 + r3 * 0.48 : 0.42 + Math.pow(r3, 0.58) * 0.64;

      tmpPos.set(
        lobe.pos.x + Math.cos(theta) * sinPhi * lobe.rx * radFactor,
        lobe.pos.y + cosPhi * lobe.ry * radFactor,
        lobe.pos.z + Math.sin(theta) * sinPhi * lobe.rz * radFactor
      );

      tmpNorm.subVectors(tmpPos, crownCenter);
      tmpNorm.y += 0.55;
      tmpNorm.normalize();
      crownNorms[i * 3] = tmpNorm.x;
      crownNorms[i * 3 + 1] = tmpNorm.y;
      crownNorms[i * 3 + 2] = tmpNorm.z;

      const heightAO = smootherstep(2.45, 5.2, tmpPos.y);
      const radialAO = smootherstep(0.45, 2.2, tmpPos.distanceTo(crownCenter));
      aoValues[i] = Math.min(1.0, (isInnerCore ? 0.22 : 0.42) + heightAO * 0.42 + radialAO * 0.34);
      phases[i] = r1 * 6.2831 + r3 * 4.0;

      dummyObj.position.copy(tmpPos);
      dummyObj.rotation.set(
        (r2 - 0.5) * 0.85,
        r1 * Math.PI * 2,
        (r3 - 0.5) * 0.85
      );
      const sc = isInnerCore ? 1.15 + r4 * 0.45 : 0.82 + r4 * 0.48;
      dummyObj.scale.setScalar(sc);
      dummyObj.updateMatrix();
      matrices.push(dummyObj.matrix.clone());
    }

    geo.setAttribute('aCrownNorm', new THREE.InstancedBufferAttribute(crownNorms, 3));
    geo.setAttribute('aAO', new THREE.InstancedBufferAttribute(aoValues, 1));
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
    geo.instanceCount = totalClusters;

    return {
      trunkGeo: tGeo,
      branches: branchGeos,
      foliageGeo: geo,
      clusterMatrices: matrices,
    };
  }, [seed]);

  const uniforms = useMemo(
    () => ({
      uMap: { value: leafTex },
      uTime: { value: 0 },
      uWindStrength: { value: 0.03 },
      uWindSpeed: { value: 1.6 },
      uSunDir: { value: new THREE.Vector3(0, 0.5, -1).normalize() },
      uSunColor: { value: new THREE.Color('#FFF5DC') },
      uSunIntensity: { value: 1.2 },
      uHemiSky: { value: new THREE.Color('#FFFDF8') },
      uHemiGround: { value: new THREE.Color('#4A3628') },
      uHemiIntensity: { value: 1.0 },
      uFoliageTint: { value: new THREE.Color('#DCE4CA') },
      uFogColor: { value: new THREE.Color('#CBE2F2') },
      uFogDensity: { value: 0.009 },
    }),
    [leafTex]
  );

  useEffect(() => {
    const mesh = foliageMeshRef.current;
    if (!mesh) return;
    clusterMatrices.forEach((m, idx) => {
      mesh.setMatrixAt(idx, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [clusterMatrices]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    if (crownRef.current) {
      const sway = weather === 'BREEZY' ? 0.022 : weather === 'RAIN' ? 0.014 : 0.0055;
      const spd = weather === 'BREEZY' ? 1.85 : 1.0;
      crownRef.current.rotation.z = Math.sin(t * spd + seed * 2.1) * sway;
      crownRef.current.rotation.x = Math.cos(t * spd * 0.8 + seed) * sway * 0.45;
    }

    if (foliageMatRef.current) {
      const u = foliageMatRef.current.uniforms;
      u.uTime.value = t;
      u.uWindStrength.value = weather === 'BREEZY' ? 0.068 : weather === 'RAIN' ? 0.042 : 0.022;
      u.uWindSpeed.value = weather === 'BREEZY' ? 2.9 : weather === 'RAIN' ? 2.1 : 1.35;

      const [lx, ly, lz] = atmosphere.sunLightPosition;
      u.uSunDir.value.set(lx, ly, lz).normalize();
      u.uSunColor.value.set(atmosphere.sunColor);

      // Match OrihourCanvas directionalLight (sunIntensity * 0.68) & hemisphereLight (hemiIntensity * 0.92)
      u.uSunIntensity.value = atmosphere.sunIntensity * 0.68;
      u.uHemiSky.value.set(atmosphere.roomFillColor);
      u.uHemiGround.value.set(atmosphere.hemiGround);
      u.uHemiIntensity.value = atmosphere.hemiIntensity * 0.92;
      u.uFoliageTint.value.set(landscapeTint);
      u.uFogColor.value.set(atmosphere.fogColor);
    }
  });

  return (
    <group position={[x, baseY, z]} scale={[scale, scale, scale]}>
      {/* Grounded Soft Tree Contact Shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.14, 0]}>
        <planeGeometry args={[5.8, 5.8]} />
        <meshBasicMaterial map={shadowTex} transparent opacity={0.4} depthWrite={false} />
      </mesh>

      {/* Natural Weathered Bark Trunk (Balanced albedo tint so backlit trunk never turns pitch black!) */}
      <mesh geometry={trunkGeo}>
        <meshStandardMaterial
          map={bark.map}
          bumpMap={bark.bumpMap}
          bumpScale={0.028}
          color={barkTint}
          roughness={0.96}
          metalness={0.0}
        />
      </mesh>

      {/* Supporting Boughs Matching Trunk Tone */}
      {branches.map((bGeo, idx) => (
        <mesh key={idx} geometry={bGeo}>
          <meshStandardMaterial
            map={bark.map}
            color={barkTint}
            roughness={0.96}
            metalness={0.0}
          />
        </mesh>
      ))}

      {/* PBR-Calibrated Cohesive Foliage Crown */}
      <group ref={crownRef}>
        <instancedMesh
          ref={foliageMeshRef}
          args={[foliageGeo, undefined, clusterMatrices.length]}
          frustumCulled={false}
        >
          <shaderMaterial
            ref={foliageMatRef}
            vertexShader={FOLIAGE_VERT}
            fragmentShader={FOLIAGE_FRAG}
            uniforms={uniforms}
            side={THREE.DoubleSide}
          />
        </instancedMesh>
      </group>
    </group>
  );
}

// Dense Seamless Instanced Meadow Grass
function InstancedMeadowGrass({
  grassTex,
  weather,
  groundTint,
}: {
  grassTex: THREE.CanvasTexture;
  weather: WeatherType;
  groundTint: string;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = 1600;

  const tuftGeo = useMemo(() => {
    const p1 = new THREE.PlaneGeometry(0.78, 0.54);
    p1.translate(0, 0.23, 0);

    const p2 = new THREE.PlaneGeometry(0.78, 0.54);
    p2.rotateY(Math.PI * 0.48);
    p2.translate(0, 0.23, 0);

    const merged = new THREE.BufferGeometry();
    const pos1 = p1.attributes.position.array as Float32Array;
    const pos2 = p2.attributes.position.array as Float32Array;
    const uv1 = p1.attributes.uv.array as Float32Array;
    const uv2 = p2.attributes.uv.array as Float32Array;

    const positions = new Float32Array(pos1.length + pos2.length);
    positions.set(pos1, 0);
    positions.set(pos2, pos1.length);

    const totalVerts = positions.length / 3;
    const normals = new Float32Array(totalVerts * 3);
    for (let i = 0; i < totalVerts; i++) {
      normals[i * 3] = 0;
      normals[i * 3 + 1] = 1;
      normals[i * 3 + 2] = 0;
    }

    const uvs = new Float32Array(uv1.length + uv2.length);
    uvs.set(uv1, 0);
    uvs.set(uv2, uv1.length);

    const idx1 = Array.from(p1.index!.array);
    const vOffset = p1.attributes.position.count;
    const idx2 = Array.from(p2.index!.array).map((v) => v + vOffset);

    merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    merged.setIndex([...idx1, ...idx2]);
    return merged;
  }, []);

  const tufts = useMemo(() => {
    const items: {
      x: number;
      y: number;
      z: number;
      rotY: number;
      sx: number;
      sy: number;
      phase: number;
      color: THREE.Color;
    }[] = [];

    const palette = [
      new THREE.Color('#D4DFB4'),
      new THREE.Color('#C4D3A2'),
      new THREE.Color('#DFE4B8'),
      new THREE.Color('#B7C896'),
      new THREE.Color('#CCD7AB'),
    ];

    for (let i = 0; i < count; i++) {
      const r1 = hash01(i * 1.91 + 0.3);
      const r2 = hash01(i * 3.47 + 2.1);
      const r3 = hash01(i * 5.83 + 4.7);
      const r4 = hash01(i * 7.19 + 6.3);

      const zNorm = Math.pow(r2, 1.45);
      const z = -2.85 - zNorm * 23.0;
      const spreadX = 6.8 + zNorm * 14.8;
      const x = -0.15 + (r1 - 0.5) * 2 * spreadX;
      const y = getTerrainHeight(x, z) - 0.08;

      const scaleBase = 0.78 + r3 * 0.74;
      items.push({
        x,
        y,
        z,
        rotY: r4 * Math.PI * 2,
        sx: scaleBase * (0.95 + r1 * 0.32),
        sy: scaleBase * (0.72 + r4 * 0.46),
        phase: x * 0.42 + z * 0.35,
        color: palette[i % palette.length],
      });
    }
    return items;
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    tufts.forEach((t, i) => {
      dummy.position.set(t.x, t.y, t.z);
      dummy.rotation.set(0, t.rotY, 0);
      dummy.scale.set(t.sx, t.sy, t.sx);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, t.color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [tufts, dummy]);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const elapsed = clock.getElapsedTime();
    const swayAmp = weather === 'BREEZY' ? 0.19 : weather === 'RAIN' ? 0.12 : 0.06;
    const swaySpeed = weather === 'BREEZY' ? 2.6 : weather === 'RAIN' ? 1.85 : 1.1;

    for (let i = 0; i < count; i++) {
      const t = tufts[i];
      const wave = Math.sin(elapsed * swaySpeed + t.phase);
      dummy.position.set(t.x, t.y, t.z);
      dummy.rotation.set(wave * swayAmp * 0.42, t.rotY, wave * swayAmp);
      dummy.scale.set(t.sx, t.sy, t.sx);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[tuftGeo, undefined, count]}>
      <meshStandardMaterial
        map={grassTex}
        color={groundTint}
        alphaTest={0.28}
        transparent
        roughness={0.96}
        metalness={0.0}
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  );
}

// ==================== SUBTLE AMBIENT NATURE ELEMENTS ====================

// 1. Morning / Daytime Sky: Sculpted Curved-Wing Gliding Birds
function SoaringBirds({ active }: { active: boolean }) {
  const flockRef = useRef<THREE.Group>(null);
  const flight = useRef({ x: -24, activeNow: false });

  const { leftWingGeo, rightWingGeo } = useMemo(() => {
    const buildWing = (dir: -1 | 1) => {
      const s = new THREE.Shape();
      s.moveTo(0, 0.03);
      s.quadraticCurveTo(dir * 0.11, 0.07, dir * 0.28, 0.01);
      s.quadraticCurveTo(dir * 0.16, -0.025, dir * 0.07, -0.045);
      s.quadraticCurveTo(dir * 0.03, -0.04, 0, -0.03);
      s.closePath();
      const g = new THREE.ShapeGeometry(s, 10);
      g.rotateX(-Math.PI / 2);
      return g;
    };
    return {
      leftWingGeo: buildWing(-1),
      rightWingGeo: buildWing(1),
    };
  }, []);

  const birds = useMemo(
    () => [
      { ox: 0, oy: 0, oz: 0, phase: 0.0, scale: 1.0 },
      { ox: -1.35, oy: 0.35, oz: -1.1, phase: 1.4, scale: 0.86 },
      { ox: -2.4, oy: -0.18, oz: -1.8, phase: 2.7, scale: 0.78 },
      { ox: 1.45, oy: 0.42, oz: -1.2, phase: 3.9, scale: 0.9 },
    ],
    []
  );

  useFrame(({ clock }, delta) => {
    if (!flockRef.current) return;
    const dt = Math.min(delta, 0.05);
    const f = flight.current;

    if (active && !f.activeNow) {
      f.activeNow = true;
      f.x = -24;
    }

    if (f.activeNow) {
      f.x += dt * 1.4;
      if (f.x > 25) {
        if (active) {
          f.x = -24;
        } else {
          f.activeNow = false;
        }
      }
    }

    flockRef.current.visible = f.activeNow;
    if (!f.activeNow) return;

    const t = clock.getElapsedTime();
    const y = 7.6 + Math.sin(t * 0.42) * 0.65;
    flockRef.current.position.set(f.x, y, -32);

    flockRef.current.children.forEach((birdGroup, idx) => {
      const b = birds[idx];
      const glideWave = Math.sin(t * 0.9 + b.phase);
      const flapStrength = glideWave > -0.15 ? 0.46 : 0.06;
      const flap = Math.sin(t * 6.8 + b.phase) * flapStrength + 0.08;
      const leftWing = birdGroup.children[1];
      const rightWing = birdGroup.children[2];
      if (leftWing) leftWing.rotation.z = flap;
      if (rightWing) rightWing.rotation.z = -flap;
      birdGroup.position.y = b.oy + Math.sin(t * 2.0 + b.phase) * 0.1;
    });
  });

  return (
    <group ref={flockRef} visible={false}>
      {birds.map((b, idx) => (
        <group
          key={idx}
          position={[b.ox, b.oy, b.oz]}
          rotation={[0, Math.PI * 0.42, 0]}
          scale={[b.scale, b.scale, b.scale]}
        >
          <mesh rotation={[Math.PI / 2, 0, 0]} scale={[0.7, 1.0, 0.7]}>
            <capsuleGeometry args={[0.025, 0.12, 4, 8]} />
            <meshBasicMaterial color="#252C34" />
          </mesh>
          <mesh geometry={leftWingGeo}>
            <meshBasicMaterial color="#252C34" side={THREE.DoubleSide} />
          </mesh>
          <mesh geometry={rightWingGeo}>
            <meshBasicMaterial color="#252C34" side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// 2. Breezy / Golden Hour: Delicate Windblown Leaves Drifting Gently Past the Window
function DriftingWindLeaves({
  active,
  breezy,
  leafTex,
  tint,
}: {
  active: boolean;
  breezy: boolean;
  leafTex: THREE.CanvasTexture;
  tint: string;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const fadeRef = useRef(active ? 1 : 0);
  const count = 34;

  const leaves = useMemo(() => {
    const arr: {
      x: number;
      y: number;
      z: number;
      vx: number;
      vy: number;
      rotSpeedX: number;
      rotSpeedY: number;
      rotSpeedZ: number;
      phase: number;
      scale: number;
    }[] = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        x: -9 + hash01(i * 1.73 + 0.4) * 18,
        y: 1.4 + hash01(i * 3.19 + 1.2) * 4.4,
        z: -4.8 - hash01(i * 5.47 + 2.6) * 9.5,
        vx: 0.75 + hash01(i * 7.11) * 0.85,
        vy: 0.2 + hash01(i * 9.37) * 0.25,
        rotSpeedX: 1.2 + hash01(i * 11.1) * 1.6,
        rotSpeedY: 0.9 + hash01(i * 13.7) * 1.4,
        rotSpeedZ: 1.0 + hash01(i * 15.3) * 1.5,
        phase: hash01(i * 17.9) * Math.PI * 2,
        scale: 0.1 + hash01(i * 19.3) * 0.07,
      });
    }
    return arr;
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const targetFade = active ? 1 : 0;
    fadeRef.current += (targetFade - fadeRef.current) * Math.min(1, dt * 1.8);

    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.visible = fadeRef.current > 0.01;
    if (!mesh.visible) return;

    if (matRef.current) {
      matRef.current.opacity = fadeRef.current * 0.88;
    }

    const t = clock.getElapsedTime();
    const speedMult = breezy ? 1.85 : 1.0;

    for (let i = 0; i < count; i++) {
      const l = leaves[i];
      l.x += l.vx * speedMult * dt;
      l.y -= l.vy * dt;
      const flutterY = Math.sin(t * 2.2 + l.phase) * 0.18;

      if (l.x > 10.5 || l.y < 0.2) {
        l.x = -10.5 - hash01(i * 2.1 + t) * 2.0;
        l.y = 3.2 + hash01(i * 4.7 + t) * 3.0;
      }

      dummy.position.set(l.x, l.y + flutterY, l.z);
      dummy.rotation.set(
        t * l.rotSpeedX + l.phase,
        t * l.rotSpeedY,
        t * l.rotSpeedZ
      );
      dummy.scale.setScalar(l.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} visible={false}>
      <planeGeometry args={[1, 1]} />
      <meshStandardMaterial
        ref={matRef}
        map={leafTex}
        color={tint}
        transparent
        opacity={0}
        alphaTest={0.2}
        roughness={0.85}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

// 3. Night Only (18:45 - 04:45): Delicate Circular Bioluminescent Fireflies (clamped point size, smooth fade)
function NightFireflies({ active }: { active: boolean }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const fadeRef = useRef(active ? 1 : 0);
  const count = 42;

  const geo = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const x = -6.8 + hash01(i * 2.7 + 0.4) * 13.6;
      const z = -6.4 - hash01(i * 4.3 + 1.9) * 13.5;
      const y = getTerrainHeight(x, z) + 0.35 + hash01(i * 6.1 + 3.2) * 1.45;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      phases[i] = hash01(i * 9.3 + 1.7) * 6.2831;
      sizes[i] = 6.5 + hash01(i * 13.1) * 4.5;
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    g.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    return g;
  }, []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uFade: { value: active ? 1 : 0 },
    }),
    []
  );

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const target = active ? 1 : 0;
    fadeRef.current += (target - fadeRef.current) * Math.min(1, dt * 1.8);

    if (pointsRef.current) {
      pointsRef.current.visible = fadeRef.current > 0.01;
    }
    if (!matRef.current || fadeRef.current <= 0.01) return;

    matRef.current.uniforms.uTime.value = clock.getElapsedTime();
    matRef.current.uniforms.uFade.value = fadeRef.current;
  });

  return (
    <points ref={pointsRef} geometry={geo} visible={active}>
      <shaderMaterial
        ref={matRef}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={`
          attribute float aPhase;
          attribute float aSize;
          uniform float uTime;
          varying float vPulse;

          void main() {
            vec3 pos = position;
            pos.x += sin(uTime * 0.55 + aPhase) * 0.55;
            pos.y += sin(uTime * 0.88 + aPhase * 1.7) * 0.24;
            pos.z += cos(uTime * 0.48 + aPhase * 1.3) * 0.42;

            float wave = sin(uTime * (0.85 + fract(aPhase) * 0.9) + aPhase * 3.1);
            vPulse = smoothstep(-0.15, 0.95, wave);

            vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
            float rawSize = aSize * (9.0 / max(4.0, -mvPos.z)) * (0.65 + 0.35 * vPulse);
            gl_PointSize = clamp(rawSize, 2.5, 11.0);
            gl_Position = projectionMatrix * mvPos;
          }
        `}
        fragmentShader={`
          uniform float uFade;
          varying float vPulse;

          void main() {
            float d = length(gl_PointCoord - vec2(0.5));
            if (d > 0.5) discard;
            float core = smoothstep(0.24, 0.0, d);
            float halo = pow(smoothstep(0.5, 0.0, d), 2.4) * 0.65;
            vec3 col = mix(vec3(0.92, 0.95, 0.42), vec3(1.0, 0.98, 0.82), core);
            float alpha = (core + halo) * vPulse * uFade * 0.82;
            gl_FragColor = vec4(col, alpha);
          }
        `}
      />
    </points>
  );
}

// Soft Drifting Cumulus Clouds Framed Cleanly in the Window Sky
function DriftingClouds({
  weather,
  atmosphere,
}: {
  weather: WeatherType;
  atmosphere: AtmosphereState;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const c0 = useMemo(() => createCloudTexture(0), []);
  const c1 = useMemo(() => createCloudTexture(1), []);
  const c2 = useMemo(() => createCloudTexture(2), []);
  const texList = useMemo(() => [c0, c1, c2], [c0, c1, c2]);

  const clouds = useMemo(
    () => [
      { x: -12, y: 7.4, z: -36, w: 14.5, h: 6.4, speed: 0.22, tex: 0 },
      { x: -1.5, y: 8.6, z: -40, w: 17.5, h: 7.4, speed: 0.17, tex: 1 },
      { x: 9.5, y: 7.1, z: -35, w: 13.8, h: 6.0, speed: 0.26, tex: 2 },
      { x: -22, y: 8.1, z: -38, w: 16.0, h: 6.8, speed: 0.2, tex: 1 },
      { x: 19.5, y: 8.9, z: -41, w: 17.0, h: 7.2, speed: 0.15, tex: 0 },
      { x: 4.0, y: 9.8, z: -43, w: 19.0, h: 7.6, speed: 0.13, tex: 2 },
    ],
    []
  );

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const dt = Math.min(delta, 0.05);
    const windMult = weather === 'BREEZY' ? 2.5 : weather === 'RAIN' ? 1.7 : 1.0;

    groupRef.current.children.forEach((child, idx) => {
      const c = clouds[idx];
      child.position.x += c.speed * windMult * dt;
      if (child.position.x > 32) {
        child.position.x = -32;
      }
    });
  });

  const baseOpacity =
    weather === 'RAIN'
      ? 0.82
      : weather === 'CLOUDY'
      ? 0.86
      : weather === 'BREEZY'
      ? 0.68
      : 0.56;

  const cloudTint = useMemo(() => {
    const col = new THREE.Color('#FFFFFF');
    col.lerp(new THREE.Color(atmosphere.skyHorizon), 0.34);
    if (weather === 'RAIN') col.multiplyScalar(0.54);
    else if (weather === 'CLOUDY') col.multiplyScalar(0.84);
    else if (atmosphere.isNightHud) col.multiplyScalar(0.36);
    return col;
  }, [atmosphere.skyHorizon, atmosphere.isNightHud, weather]);

  return (
    <group ref={groupRef}>
      {clouds.map((c, idx) => (
        <mesh key={idx} position={[c.x, c.y, c.z]}>
          <planeGeometry args={[c.w, c.h]} />
          <meshBasicMaterial
            map={texList[c.tex]}
            color={cloudTint}
            transparent
            opacity={baseOpacity}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

// Fine Multi-Depth Wind-Slanted Outdoor Rain Streaks
function OutdoorRainStreaks({ active }: { active: boolean }) {
  const linesRef = useRef<THREE.LineSegments>(null);
  const count = 420;

  const { geo, speeds, lengths } = useMemo(() => {
    const pos = new Float32Array(count * 6);
    const spd = new Float32Array(count);
    const lens = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const x = -11 + hash01(i * 1.7 + 0.2) * 22;
      const y = 0.2 + hash01(i * 3.1 + 1.4) * 11.5;
      const z = -2.6 - hash01(i * 5.3 + 2.9) * 15.5;
      const len = 0.38 + hash01(i * 7.9) * 0.36;
      const slant = len * 0.14;
      pos[i * 6 + 0] = x;
      pos[i * 6 + 1] = y;
      pos[i * 6 + 2] = z;
      pos[i * 6 + 3] = x - slant;
      pos[i * 6 + 4] = y - len;
      pos[i * 6 + 5] = z;
      spd[i] = 13.5 + hash01(i * 11.3) * 6.5;
      lens[i] = len;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return { geo: g, speeds: spd, lengths: lens };
  }, []);

  useFrame((_, delta) => {
    if (!active || !linesRef.current) return;
    const dt = Math.min(delta, 0.05);
    const attr = linesRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;

    for (let i = 0; i < count; i++) {
      const dy = speeds[i] * dt;
      const dx = dy * 0.14;
      arr[i * 6 + 0] -= dx;
      arr[i * 6 + 1] -= dy;
      arr[i * 6 + 3] -= dx;
      arr[i * 6 + 4] -= dy;

      if (arr[i * 6 + 1] < -0.6) {
        const rx = -10.5 + ((arr[i * 6 + 0] + 24.5) % 21);
        const ry = 10.2 + hash01(i * 4.3) * 2.4;
        const len = lengths[i];
        arr[i * 6 + 0] = rx;
        arr[i * 6 + 1] = ry;
        arr[i * 6 + 3] = rx - len * 0.14;
        arr[i * 6 + 4] = ry - len;
      }
    }
    attr.needsUpdate = true;
  });

  if (!active) return null;

  return (
    <lineSegments ref={linesRef} geometry={geo}>
      <lineBasicMaterial color="#B8CBE0" transparent opacity={0.22} depthWrite={false} />
    </lineSegments>
  );
}

export default function WindowWorld({
  atmosphere,
  weather,
  hourDecimal,
}: WindowWorldProps) {
  const meadow = useMemo(() => createMeadowPbr(), []);
  const grassTex = useMemo(() => createGrassClumpTexture(), []);
  const bark = useMemo(() => createBarkPbr(), []);
  const leafTex = useMemo(() => createLeafSprigTexture(), []);
  const driftingLeafTex = useMemo(() => createDriftingLeafTexture(), []);
  const sunTex = useMemo(() => createSunTexture(), []);
  const moonTex = useMemo(() => createMoonTexture(), []);
  const shadowTex = useMemo(() => createSoftShadowTexture(), []);

  // Continuous C2-Smooth High-Resolution Meadow & Rolling Horizon Hills Mesh (Zero crease lines!)
  const terrainGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(128, 58, 128, 88);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);

    const nearCol = new THREE.Color('#FFFFFF');
    const midHillCol = new THREE.Color('#C8D8CC');
    const farHillCol = new THREE.Color('#A2BAC8');
    const tmpCol = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const wx = pos.getX(i);
      const wz = pos.getZ(i) - 31.4;
      const wy = getTerrainHeight(wx, wz);
      pos.setY(i, wy);

      const dist = Math.max(0, -wz - 2.4);
      const midT = smootherstep(10, 42, dist);
      const farT = smootherstep(28, 58, dist);
      tmpCol.copy(nearCol).lerp(midHillCol, midT).lerp(farHillCol, farT);
      colors[i * 3] = tmpCol.r;
      colors[i * 3 + 1] = tmpCol.g;
      colors[i * 3 + 2] = tmpCol.b;
    }

    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);

  // Unified ambient color tones shared across terrain, grass, tree foliage & weathered bark
  const landscapeTint = useMemo(() => {
    if (weather === 'RAIN') return '#8E9D8C';
    if (weather === 'CLOUDY') return '#B8C4AA';
    return atmosphere.isNightHud ? '#7E909E' : '#DCE4CA';
  }, [weather, atmosphere.isNightHud]);

  const barkTint = useMemo(() => {
    if (weather === 'RAIN') return '#888E88';
    if (weather === 'CLOUDY') return '#A8A298';
    return atmosphere.isNightHud ? '#7D8A96' : '#C6B8A6';
  }, [weather, atmosphere.isNightHud]);

  const dry = weather !== 'RAIN';
  const showBirds = dry && hourDecimal >= 6.0 && hourDecimal <= 14.5;
  const showWindLeaves =
    dry && (weather === 'BREEZY' || (hourDecimal >= 14.5 && hourDecimal <= 18.25));
  const showFireflies = dry && (hourDecimal >= 18.75 || hourDecimal <= 4.75);

  return (
    <group>
      {/* Atmospheric Scattering Sky Dome */}
      <SkyDome atmosphere={atmosphere} />

      {/* Natural Circular Twinkling Stars */}
      <Starfield opacity={atmosphere.starOpacity} />

      {/* Smooth Atmospheric Sun behind the 3D Rolling Hills */}
      {atmosphere.sunOpacity > 0.02 && (
        <mesh position={atmosphere.sunPosition}>
          <planeGeometry args={[16.5, 16.5]} />
          <meshBasicMaterial
            map={sunTex}
            color={atmosphere.sunColor}
            transparent
            opacity={atmosphere.sunOpacity}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            fog={false}
          />
        </mesh>
      )}

      {/* Natural Full Moon with Soft Halo behind the 3D Rolling Hills */}
      {atmosphere.moonOpacity > 0.02 && (
        <mesh position={atmosphere.moonPosition}>
          <planeGeometry args={[9.2, 9.2]} />
          <meshBasicMaterial
            map={moonTex}
            transparent
            opacity={atmosphere.moonOpacity}
            depthWrite={false}
            fog={false}
          />
        </mesh>
      )}

      {/* Drifting Cumulus Clouds */}
      <DriftingClouds weather={weather} atmosphere={atmosphere} />

      {/* Seamless C2-Smooth 3D Meadow & Rolling Hills Terrain */}
      <mesh geometry={terrainGeo} position={[0, 0, -31.4]}>
        <meshStandardMaterial
          map={meadow.map}
          bumpMap={meadow.bumpMap}
          bumpScale={0.008}
          color={landscapeTint}
          vertexColors
          roughness={0.98}
          metalness={0.0}
        />
      </mesh>

      {/* 1,600 Dense Upward-Normal Meadow Grass Tufts Fused Seamlessly with the Ground */}
      <InstancedMeadowGrass
        grassTex={grassTex}
        weather={weather}
        groundTint={landscapeTint}
      />

      {/* PBR-Matched Deciduous Framing Trees (Natural Olive Foliage & Cohesive Weathered Bark) */}
      <NaturalMeadowTree
        x={-4.6}
        z={-8.4}
        scale={1.16}
        seed={2}
        weather={weather}
        atmosphere={atmosphere}
        bark={bark}
        leafTex={leafTex}
        shadowTex={shadowTex}
        landscapeTint={landscapeTint}
        barkTint={barkTint}
      />
      <NaturalMeadowTree
        x={3.65}
        z={-9.2}
        scale={1.08}
        seed={5}
        weather={weather}
        atmosphere={atmosphere}
        bark={bark}
        leafTex={leafTex}
        shadowTex={shadowTex}
        landscapeTint={landscapeTint}
        barkTint={barkTint}
      />
      <NaturalMeadowTree
        x={-8.8}
        z={-17.8}
        scale={1.3}
        seed={9}
        weather={weather}
        atmosphere={atmosphere}
        bark={bark}
        leafTex={leafTex}
        shadowTex={shadowTex}
        landscapeTint={landscapeTint}
        barkTint={barkTint}
      />
      <NaturalMeadowTree
        x={7.9}
        z={-19.2}
        scale={1.24}
        seed={14}
        weather={weather}
        atmosphere={atmosphere}
        bark={bark}
        leafTex={leafTex}
        shadowTex={shadowTex}
        landscapeTint={landscapeTint}
        barkTint={barkTint}
      />

      {/* Ambient Nature Elements: Gliding Birds (Morning–Day), Windblown Leaves (Breezy/Golden Hour), Fireflies (Night) */}
      <SoaringBirds active={showBirds} />
      <DriftingWindLeaves
        active={showWindLeaves}
        breezy={weather === 'BREEZY'}
        leafTex={driftingLeafTex}
        tint={landscapeTint}
      />
      <NightFireflies active={showFireflies} />

      {/* Fine Multi-Depth Wind-Slanted Outdoor Rain */}
      <OutdoorRainStreaks active={weather === 'RAIN'} />
    </group>
  );
}