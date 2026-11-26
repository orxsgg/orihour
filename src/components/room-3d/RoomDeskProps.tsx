'use client';

import React, { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { PosterItem, RoomConfig, WeatherType } from '@/types/orihour';
import {
  createMaroonRugPbr,
  createPlasterWallPbr,
  createPosterFallbackTexture,
  createWallPlaqueTexture,
  createWalnutWoodPbr,
} from './textures';
import RainyWindowGlass from './RainyWindowGlass';

interface RoomDeskProps {
  config: RoomConfig;
  wallTint: string;
  weather: WeatherType;
  lampOn: boolean;
  interactionLocked?: boolean;
  onToggleLamp: () => void;
  onCycleWeather: () => void;
  onHoverLabel: (label: string | null) => void;
}

// Sculpted Mid-Century Architect Desk Lamp (Sealed Rim — Zero Light Leak Speckles)
function ArticulatedDeskLamp({
  lampOn,
  locked,
  onToggleLamp,
  onHoverLabel,
}: {
  lampOn: boolean;
  locked: boolean;
  onToggleLamp: () => void;
  onHoverLabel: (label: string | null) => void;
}) {
  const { outerShadeGeo, innerShadeGeo } = useMemo(() => {
    const outerPts = [
      new THREE.Vector2(0.132, -0.102),
      new THREE.Vector2(0.128, -0.094),
      new THREE.Vector2(0.114, -0.058),
      new THREE.Vector2(0.088, -0.012),
      new THREE.Vector2(0.056, 0.024),
      new THREE.Vector2(0.032, 0.044),
      new THREE.Vector2(0.028, 0.068),
      new THREE.Vector2(0.001, 0.068),
    ];
    const innerPts = [
      new THREE.Vector2(0.118, -0.092),
      new THREE.Vector2(0.103, -0.056),
      new THREE.Vector2(0.077, -0.013),
      new THREE.Vector2(0.045, 0.021),
      new THREE.Vector2(0.02, 0.056),
      new THREE.Vector2(0.001, 0.058),
    ];
    return {
      outerShadeGeo: new THREE.LatheGeometry(outerPts, 40),
      innerShadeGeo: new THREE.LatheGeometry(innerPts, 40),
    };
  }, []);

  useEffect(() => {
    return () => {
      outerShadeGeo.dispose();
      innerShadeGeo.dispose();
    };
  }, [outerShadeGeo, innerShadeGeo]);

  return (
    <group
      position={[1.92, 1.48, -0.24]}
      rotation={[0, -0.32, 0]}
      onClick={(e) => {
        if (locked) return;
        e.stopPropagation();
        onToggleLamp();
      }}
      onPointerOver={(e) => {
        if (locked) return;
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
        onHoverLabel(lampOn ? 'Desk Lamp: Turn Off' : 'Desk Lamp: Turn On');
      }}
      onPointerOut={() => {
        if (locked) return;
        document.body.style.cursor = 'auto';
        onHoverLabel(null);
      }}
    >
      <mesh position={[0, 0.014, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.136, 0.146, 0.028, 28]} />
        <meshStandardMaterial color="#1C1F26" roughness={0.38} metalness={0.7} />
      </mesh>
      <mesh position={[0, 0.032, 0]} castShadow>
        <cylinderGeometry args={[0.112, 0.126, 0.012, 28]} />
        <meshStandardMaterial color="#252932" roughness={0.4} metalness={0.68} />
      </mesh>
      <mesh position={[-0.072, 0.042, 0.048]} rotation={[0, 0, lampOn ? 0.25 : -0.25]}>
        <cylinderGeometry args={[0.005, 0.006, 0.018, 10]} />
        <meshStandardMaterial color="#D4AA63" roughness={0.24} metalness={0.9} />
      </mesh>
      <mesh position={[0, 0.056, 0]} castShadow>
        <cylinderGeometry args={[0.02, 0.026, 0.042, 18]} />
        <meshStandardMaterial color="#C89B54" roughness={0.26} metalness={0.88} />
      </mesh>

      <group position={[0, 0.072, 0]} rotation={[0, 0, -0.28]}>
        <mesh>
          <sphereGeometry args={[0.02, 12, 12]} />
          <meshStandardMaterial color="#C89B54" roughness={0.26} metalness={0.88} />
        </mesh>
        <mesh position={[0, 0.195, 0]} castShadow>
          <cylinderGeometry args={[0.011, 0.013, 0.39, 12]} />
          <meshStandardMaterial color="#21242C" roughness={0.36} metalness={0.76} />
        </mesh>

        <group position={[0, 0.39, 0]} rotation={[0, 0, 1.1]}>
          <mesh castShadow>
            <sphereGeometry args={[0.021, 14, 14]} />
            <meshStandardMaterial color="#C89B54" roughness={0.24} metalness={0.9} />
          </mesh>
          <mesh position={[0, 0.205, 0]} castShadow>
            <cylinderGeometry args={[0.01, 0.0115, 0.41, 12]} />
            <meshStandardMaterial color="#21242C" roughness={0.36} metalness={0.76} />
          </mesh>

          <group position={[0, 0.41, 0]} rotation={[0, 0, -1.26]}>
            <mesh castShadow>
              <sphereGeometry args={[0.018, 12, 12]} />
              <meshStandardMaterial color="#C89B54" roughness={0.24} metalness={0.9} />
            </mesh>
            <mesh position={[0, -0.022, 0]} castShadow>
              <cylinderGeometry args={[0.022, 0.032, 0.044, 20]} />
              <meshStandardMaterial color="#C89B54" roughness={0.26} metalness={0.88} />
            </mesh>

            <group position={[0, -0.09, 0]}>
              <mesh geometry={outerShadeGeo} receiveShadow>
                <meshStandardMaterial
                  color="#6E1D2C"
                  roughness={0.34}
                  metalness={0.22}
                  side={THREE.FrontSide}
                />
              </mesh>
              <mesh position={[0, -0.099, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.128, 0.0082, 16, 40]} />
                <meshStandardMaterial color="#581623" roughness={0.32} metalness={0.26} />
              </mesh>
              <mesh geometry={innerShadeGeo}>
                <meshStandardMaterial
                  color={lampOn ? '#FFF4D6' : '#DDD6C8'}
                  emissive={lampOn ? '#FFCC78' : '#000000'}
                  emissiveIntensity={lampOn ? 0.6 : 0}
                  roughness={0.44}
                  side={THREE.BackSide}
                />
              </mesh>
              <mesh position={[0, -0.024, 0]}>
                <sphereGeometry args={[0.032, 16, 16]} />
                <meshBasicMaterial color={lampOn ? '#FFF6D8' : '#646A75'} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

function MidCenturyStudyDesk({
  wood,
}: {
  wood: ReturnType<typeof createWalnutWoodPbr>;
}) {
  const legSpecs: {
    pos: [number, number, number];
    rot: [number, number, number];
  }[] = [
    { pos: [-2.08, 0.66, -0.96], rot: [-0.045, 0, -0.055] },
    { pos: [2.12, 0.66, -0.96], rot: [-0.045, 0, 0.055] },
    { pos: [-2.08, 0.66, 0.24], rot: [0.045, 0, -0.055] },
    { pos: [2.12, 0.66, 0.24], rot: [0.045, 0, 0.055] },
  ];

  return (
    <group>
      <mesh position={[0.02, 1.452, -0.36]} castShadow receiveShadow>
        <boxGeometry args={[4.52, 0.056, 1.52]} />
        <meshStandardMaterial
          map={wood.map}
          bumpMap={wood.bumpMap}
          bumpScale={0.0018}
          roughnessMap={wood.roughnessMap}
          roughness={0.68}
          metalness={0.02}
        />
      </mesh>

      <mesh position={[0.02, 1.414, -0.36]} castShadow receiveShadow>
        <boxGeometry args={[4.44, 0.022, 1.45]} />
        <meshStandardMaterial map={wood.map} color="#4A2E1D" roughness={0.66} />
      </mesh>

      <mesh position={[0.02, 1.322, -0.37]} castShadow receiveShadow>
        <boxGeometry args={[4.26, 0.165, 1.32]} />
        <meshStandardMaterial map={wood.map} color="#4A2E1C" roughness={0.65} />
      </mesh>

      {[
        { x: -1.36, w: 1.32, handleW: 0.24 },
        { x: 0.02, w: 1.34, handleW: 0.28 },
        { x: 1.4, w: 1.32, handleW: 0.24 },
      ].map((d, idx) => (
        <group key={idx} position={[d.x, 1.322, 0.296]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[d.w, 0.142, 0.024]} />
            <meshStandardMaterial
              map={wood.map}
              bumpMap={wood.bumpMap}
              bumpScale={0.0018}
              color="#664028"
              roughness={0.64}
            />
          </mesh>
          <mesh position={[0, 0.004, 0.026]} castShadow>
            <boxGeometry args={[d.handleW, 0.011, 0.01]} />
            <meshStandardMaterial color="#C89B54" roughness={0.26} metalness={0.88} />
          </mesh>
          <mesh position={[-d.handleW * 0.38, 0.004, 0.017]}>
            <boxGeometry args={[0.012, 0.01, 0.016]} />
            <meshStandardMaterial color="#B58944" roughness={0.3} metalness={0.86} />
          </mesh>
          <mesh position={[d.handleW * 0.38, 0.004, 0.017]}>
            <boxGeometry args={[0.012, 0.01, 0.016]} />
            <meshStandardMaterial color="#B58944" roughness={0.3} metalness={0.86} />
          </mesh>
        </group>
      ))}

      {legSpecs.map((leg, idx) => (
        <group key={idx} position={leg.pos} rotation={leg.rot}>
          <mesh position={[0, 0.055, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.044, 0.026, 1.14, 16]} />
            <meshStandardMaterial map={wood.map} color="#4A2D1B" roughness={0.58} />
          </mesh>
          <mesh position={[0, -0.568, 0]} castShadow>
            <cylinderGeometry args={[0.0265, 0.0235, 0.108, 16]} />
            <meshStandardMaterial color="#C89B54" roughness={0.26} metalness={0.88} />
          </mesh>
        </group>
      ))}

      {[-2.11, 2.15].map((sx, idx) => (
        <mesh key={idx} position={[sx, 0.34, -0.36]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.016, 0.016, 1.24, 12]} />
          <meshStandardMaterial color="#422818" roughness={0.6} />
        </mesh>
      ))}

      <mesh position={[0.02, 0.34, -0.99]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.015, 0.015, 4.24, 12]} />
        <meshStandardMaterial color="#3E2516" roughness={0.62} />
      </mesh>
    </group>
  );
}

function ModernStudioSpeaker({
  position,
  rotationY,
  wood,
}: {
  position: [number, number, number];
  rotationY: number;
  wood: ReturnType<typeof createWalnutWoodPbr>;
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.015, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.22, 0.03, 0.22]} />
        <meshStandardMaterial color="#181A20" roughness={0.5} metalness={0.5} />
      </mesh>

      <group position={[0, 0.215, 0]} rotation={[-0.08, 0, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.23, 0.36, 0.23]} />
          <meshStandardMaterial color="#ECE9E2" roughness={0.38} metalness={0.05} />
        </mesh>

        <mesh position={[-0.12, 0, 0]} castShadow>
          <boxGeometry args={[0.018, 0.356, 0.226]} />
          <meshStandardMaterial map={wood.map} roughness={0.52} />
        </mesh>
        <mesh position={[0.12, 0, 0]} castShadow>
          <boxGeometry args={[0.018, 0.356, 0.226]} />
          <meshStandardMaterial map={wood.map} roughness={0.52} />
        </mesh>

        <mesh position={[0, 0, 0.114]}>
          <boxGeometry args={[0.205, 0.33, 0.008]} />
          <meshStandardMaterial color="#1E2128" roughness={0.45} metalness={0.2} />
        </mesh>

        <mesh position={[0, -0.045, 0.119]}>
          <ringGeometry args={[0.068, 0.078, 28]} />
          <meshStandardMaterial color="#C89B54" roughness={0.3} metalness={0.82} />
        </mesh>
        <mesh position={[0, -0.045, 0.118]}>
          <circleGeometry args={[0.068, 28]} />
          <meshStandardMaterial color="#2A2E38" roughness={0.55} />
        </mesh>
        <mesh position={[0, -0.045, 0.121]}>
          <sphereGeometry args={[0.022, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
          <meshStandardMaterial color="#12141A" roughness={0.28} metalness={0.3} />
        </mesh>

        <mesh position={[0, 0.09, 0.119]}>
          <ringGeometry args={[0.028, 0.042, 24]} />
          <meshStandardMaterial color="#383D4A" roughness={0.32} metalness={0.6} />
        </mesh>
        <mesh position={[0, 0.09, 0.12]}>
          <sphereGeometry args={[0.018, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
          <meshStandardMaterial color="#101218" roughness={0.2} metalness={0.4} />
        </mesh>

        <mesh position={[0, -0.14, 0.119]}>
          <boxGeometry args={[0.11, 0.016, 0.004]} />
          <meshStandardMaterial color="#090A0D" roughness={0.9} />
        </mesh>
        <mesh position={[0.075, 0.135, 0.12]}>
          <sphereGeometry args={[0.0045, 8, 8]} />
          <meshBasicMaterial color="#34D399" />
        </mesh>
      </group>
    </group>
  );
}

function ModernBedroomDoor({
  wood,
}: {
  wood: ReturnType<typeof createWalnutWoodPbr>;
}) {
  return (
    <group position={[-0.78, 0.04, 5.245]} rotation={[0, Math.PI, 0]}>
      <mesh position={[0, 0.006, 0.012]} receiveShadow>
        <boxGeometry args={[1.42, 0.012, 0.085]} />
        <meshStandardMaterial color="#352116" roughness={0.48} />
      </mesh>
      <mesh position={[0, 0.018, 0.01]}>
        <boxGeometry args={[1.38, 0.014, 0.036]} />
        <meshStandardMaterial color="#120C09" roughness={0.95} />
      </mesh>

      <mesh position={[-0.77, 1.66, 0.024]} castShadow receiveShadow>
        <boxGeometry args={[0.12, 3.32, 0.068]} />
        <meshStandardMaterial color="#3B2416" roughness={0.5} />
      </mesh>
      <mesh position={[0.77, 1.66, 0.024]} castShadow receiveShadow>
        <boxGeometry args={[0.12, 3.32, 0.068]} />
        <meshStandardMaterial color="#3B2416" roughness={0.5} />
      </mesh>
      <mesh position={[0, 3.29, 0.028]} castShadow receiveShadow>
        <boxGeometry args={[1.68, 0.13, 0.076]} />
        <meshStandardMaterial color="#3B2416" roughness={0.5} />
      </mesh>

      <mesh position={[-0.705, 1.62, 0.014]}>
        <boxGeometry args={[0.02, 3.22, 0.05]} />
        <meshStandardMaterial color="#1A110B" roughness={0.75} />
      </mesh>
      <mesh position={[0.705, 1.62, 0.014]}>
        <boxGeometry args={[0.02, 3.22, 0.05]} />
        <meshStandardMaterial color="#1A110B" roughness={0.75} />
      </mesh>
      <mesh position={[0, 3.22, 0.014]}>
        <boxGeometry args={[1.43, 0.02, 0.05]} />
        <meshStandardMaterial color="#1A110B" roughness={0.75} />
      </mesh>

      <mesh position={[0, 1.614, -0.006]} receiveShadow>
        <boxGeometry args={[1.38, 3.18, 0.04]} />
        <meshStandardMaterial
          map={wood.map}
          bumpMap={wood.bumpMap}
          bumpScale={0.002}
          color="#785035"
          roughness={0.58}
        />
      </mesh>

      <mesh position={[-0.59, 1.614, 0.018]} receiveShadow>
        <boxGeometry args={[0.21, 3.18, 0.022]} />
        <meshStandardMaterial
          map={wood.map}
          bumpMap={wood.bumpMap}
          bumpScale={0.002}
          color="#9A6B4A"
          roughness={0.54}
        />
      </mesh>
      <mesh position={[0.59, 1.614, 0.018]} receiveShadow>
        <boxGeometry args={[0.21, 3.18, 0.022]} />
        <meshStandardMaterial
          map={wood.map}
          bumpMap={wood.bumpMap}
          bumpScale={0.002}
          color="#9A6B4A"
          roughness={0.54}
        />
      </mesh>

      <mesh position={[0, 3.094, 0.018]} receiveShadow>
        <boxGeometry args={[0.98, 0.22, 0.022]} />
        <meshStandardMaterial map={wood.map} color="#9A6B4A" roughness={0.54} />
      </mesh>
      <mesh position={[0, 2.26, 0.018]} receiveShadow>
        <boxGeometry args={[0.98, 0.16, 0.022]} />
        <meshStandardMaterial map={wood.map} color="#9A6B4A" roughness={0.54} />
      </mesh>
      <mesh position={[0, 1.24, 0.018]} receiveShadow>
        <boxGeometry args={[0.98, 0.18, 0.022]} />
        <meshStandardMaterial map={wood.map} color="#9A6B4A" roughness={0.54} />
      </mesh>
      <mesh position={[0, 0.154, 0.018]} receiveShadow>
        <boxGeometry args={[0.98, 0.26, 0.022]} />
        <meshStandardMaterial map={wood.map} color="#9A6B4A" roughness={0.54} />
      </mesh>

      {[0.55, 1.62, 2.72].map((hy, idx) => (
        <mesh key={idx} position={[-0.7, hy, 0.036]}>
          <cylinderGeometry args={[0.012, 0.012, 0.11, 10]} />
          <meshStandardMaterial color="#C89B54" roughness={0.28} metalness={0.88} />
        </mesh>
      ))}

      <group position={[0.56, 1.48, 0.032]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.04, 0.042, 0.012, 20]} />
          <meshStandardMaterial color="#C89B54" roughness={0.26} metalness={0.9} />
        </mesh>
        <mesh position={[0, 0, 0.032]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.012, 0.014, 0.058, 14]} />
          <meshStandardMaterial color="#D4AA63" roughness={0.22} metalness={0.92} />
        </mesh>
        <mesh position={[-0.082, 0, 0.062]} castShadow>
          <boxGeometry args={[0.175, 0.022, 0.014]} />
          <meshStandardMaterial color="#D4AA63" roughness={0.22} metalness={0.92} />
        </mesh>

        <group position={[0, -0.145, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.03, 0.032, 0.01, 16]} />
            <meshStandardMaterial color="#C89B54" roughness={0.26} metalness={0.9} />
          </mesh>
          <mesh position={[0, 0, 0.018]}>
            <boxGeometry args={[0.012, 0.036, 0.024]} />
            <meshStandardMaterial color="#D4AA63" roughness={0.24} metalness={0.92} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

function FramedWallPoster({
  poster,
  position,
  rotation,
  size = [0.82, 1.12],
}: {
  poster: PosterItem;
  position: [number, number, number];
  rotation: [number, number, number];
  size?: [number, number];
}) {
  const fallbackTex = useMemo(() => createPosterFallbackTexture(poster), [poster]);
  const [customTex, setCustomTex] = useState<THREE.Texture | null>(null);

  useEffect(() => () => fallbackTex.dispose(), [fallbackTex]);

  useEffect(() => {
    if (!poster.imageUrl?.trim()) {
      setCustomTex(null);
      return;
    }
    let active = true;
    let loadedTex: THREE.Texture | null = null;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(
      poster.imageUrl.trim(),
      (tex) => {
        if (!active) {
          tex.dispose();
          return;
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        loadedTex = tex;
        setCustomTex(tex);
      },
      undefined,
      () => {
        if (active) setCustomTex(null);
      }
    );
    return () => {
      active = false;
      loadedTex?.dispose();
    };
  }, [poster.imageUrl]);

  const activeMap = customTex || fallbackTex;

  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[size[0] + 0.06, size[1] + 0.06, 0.032]} />
        <meshStandardMaterial color="#2C1C13" roughness={0.46} />
      </mesh>
      <mesh position={[0, 0, 0.018]}>
        <planeGeometry args={size} />
        <meshStandardMaterial map={activeMap} roughness={0.55} />
      </mesh>
    </group>
  );
}

export default function RoomDeskProps({
  config,
  wallTint,
  weather,
  lampOn,
  interactionLocked = false,
  onToggleLamp,
  onCycleWeather,
  onHoverLabel,
}: RoomDeskProps) {
  const plaqueTexture = useMemo(() => createWallPlaqueTexture(config), [config]);
  const wood = useMemo(() => createWalnutWoodPbr(), []);
  const plaster = useMemo(() => createPlasterWallPbr(), []);
  const maroonRug = useMemo(() => createMaroonRugPbr(), []);

  useEffect(() => () => plaqueTexture.dispose(), [plaqueTexture]);

  const frontWallGeo = useMemo(() => {
    const wall = new THREE.Shape();
    wall.moveTo(-4.4, -0.2);
    wall.lineTo(4.4, -0.2);
    wall.lineTo(4.4, 4.9);
    wall.lineTo(-4.4, 4.9);
    wall.closePath();

    const winHole = new THREE.Path();
    winHole.moveTo(-1.65, 1.58);
    winHole.lineTo(-1.65, 3.32);
    winHole.lineTo(1.35, 3.32);
    winHole.lineTo(1.35, 1.58);
    winHole.closePath();
    wall.holes.push(winHole);

    const geo = new THREE.ExtrudeGeometry(wall, {
      depth: 0.4,
      bevelEnabled: false,
    });

    const pos = geo.attributes.position as THREE.BufferAttribute;
    const uvs = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uvs[i * 2] = (pos.getX(i) + 4.4) / 8.8;
      uvs[i * 2 + 1] = (pos.getY(i) + 0.2) / 5.1;
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    return geo;
  }, []);

  return (
    <group>
      {/* Solid Light-Tight Floor Slab */}
      <mesh position={[0, -0.16, 2.0]} castShadow receiveShadow>
        <boxGeometry args={[8.6, 0.4, 7.6]} />
        <meshStandardMaterial
          map={wood.map}
          color="#72523B"
          roughness={0.78}
          shadowSide={THREE.FrontSide}
        />
      </mesh>

      {/* Woven Maroon Carpet */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.048, 2.15]} receiveShadow>
        <planeGeometry args={[4.4, 3.3]} />
        <meshStandardMaterial
          map={maroonRug.map}
          bumpMap={maroonRug.bumpMap}
          bumpScale={0.012}
          roughness={0.94}
        />
      </mesh>

      {/* Solid Light-Tight Ceiling Slab */}
      <mesh position={[0, 4.82, 2.0]} castShadow receiveShadow>
        <boxGeometry args={[8.8, 0.44, 8.0]} />
        <meshStandardMaterial
          color="#EFEAE2"
          roughness={0.92}
          shadowSide={THREE.FrontSide}
        />
      </mesh>

      {/* Flush Warm Ceiling Lamp */}
      <group position={[0, 4.54, 1.8]}>
        <mesh>
          <cylinderGeometry args={[0.26, 0.26, 0.08, 24]} />
          <meshStandardMaterial color="#2C221C" roughness={0.42} metalness={0.35} />
        </mesh>
        <mesh position={[0, -0.042, 0]}>
          <cylinderGeometry args={[0.22, 0.22, 0.02, 24]} />
          <meshBasicMaterial color="#FFF6E0" />
        </mesh>
      </group>

      {/* Mid-Century Walnut Study & Listening Desk */}
      <MidCenturyStudyDesk wood={wood} />

      {/* Front Window Wall (FrontSide shadows seal exterior sunlight cleanly without interior acne) */}
      <mesh geometry={frontWallGeo} position={[0, 0, -1.65]} castShadow receiveShadow>
        <meshStandardMaterial
          map={plaster.map}
          bumpMap={plaster.bumpMap}
          bumpScale={0.0012}
          color={wallTint}
          roughness={0.9}
          shadowSide={THREE.FrontSide}
        />
      </mesh>

      {/* Left, Right & Back Walls: castShadow with FrontSide blocks ALL stray sunlight from walls with ZERO interior acne! */}
      <mesh position={[-3.85, 2.3, 2.0]} castShadow receiveShadow>
        <boxGeometry args={[0.4, 5.2, 8.0]} />
        <meshStandardMaterial
          map={plaster.map}
          bumpMap={plaster.bumpMap}
          bumpScale={0.0012}
          color={wallTint}
          roughness={0.9}
          shadowSide={THREE.FrontSide}
        />
      </mesh>
      <mesh position={[3.85, 2.3, 2.0]} castShadow receiveShadow>
        <boxGeometry args={[0.4, 5.2, 8.0]} />
        <meshStandardMaterial
          map={plaster.map}
          bumpMap={plaster.bumpMap}
          bumpScale={0.0012}
          color={wallTint}
          roughness={0.9}
          shadowSide={THREE.FrontSide}
        />
      </mesh>
      <mesh position={[0, 2.3, 5.45]} castShadow receiveShadow>
        <boxGeometry args={[8.8, 5.2, 0.4]} />
        <meshStandardMaterial
          map={plaster.map}
          bumpMap={plaster.bumpMap}
          bumpScale={0.0012}
          color={wallTint}
          roughness={0.9}
          shadowSide={THREE.FrontSide}
        />
      </mesh>

      {/* Complete 4-Wall Wooden Baseboards */}
      <mesh position={[0, 0.1, -1.23]} receiveShadow>
        <boxGeometry args={[7.3, 0.12, 0.04]} />
        <meshStandardMaterial color="#3E281B" roughness={0.6} />
      </mesh>
      <mesh position={[-3.63, 0.1, 2.0]} receiveShadow>
        <boxGeometry args={[0.04, 0.12, 6.54]} />
        <meshStandardMaterial color="#3E281B" roughness={0.6} />
      </mesh>
      <mesh position={[3.63, 0.1, 2.0]} receiveShadow>
        <boxGeometry args={[0.04, 0.12, 6.54]} />
        <meshStandardMaterial color="#3E281B" roughness={0.6} />
      </mesh>
      <mesh position={[-2.63, 0.1, 5.23]} receiveShadow>
        <boxGeometry args={[2.04, 0.12, 0.04]} />
        <meshStandardMaterial color="#3E281B" roughness={0.6} />
      </mesh>
      <mesh position={[1.85, 0.1, 5.23]} receiveShadow>
        <boxGeometry args={[3.6, 0.12, 0.04]} />
        <meshStandardMaterial color="#3E281B" roughness={0.6} />
      </mesh>

      {/* Modern 3-Panel Bedroom Door */}
      <ModernBedroomDoor wood={wood} />

      {/* 4 Customizable Framed Wall Posters */}
      {config.posters[0] && (
        <FramedWallPoster
          poster={config.posters[0]}
          position={[-3.62, 2.35, 0.85]}
          rotation={[0, Math.PI / 2, 0]}
        />
      )}
      {config.posters[1] && (
        <FramedWallPoster
          poster={config.posters[1]}
          position={[-3.62, 2.35, 2.95]}
          rotation={[0, Math.PI / 2, 0]}
        />
      )}
      {config.posters[2] && (
        <FramedWallPoster
          poster={config.posters[2]}
          position={[3.62, 2.35, 3.25]}
          rotation={[0, -Math.PI / 2, 0]}
        />
      )}
      {config.posters[3] && (
        <FramedWallPoster
          poster={config.posters[3]}
          position={[1.55, 2.35, 5.22]}
          rotation={[0, Math.PI, 0]}
          size={[0.92, 1.24]}
        />
      )}

      {/* Window Frame & Mullions */}
      <mesh position={[-0.15, 1.58, -1.21]} castShadow receiveShadow>
        <boxGeometry args={[3.16, 0.08, 0.34]} />
        <meshStandardMaterial color="#3D2618" roughness={0.5} />
      </mesh>
      <mesh position={[-0.15, 3.32, -1.23]} castShadow>
        <boxGeometry args={[3.14, 0.08, 0.28]} />
        <meshStandardMaterial color="#3D2618" roughness={0.5} />
      </mesh>
      <mesh position={[-1.65, 2.45, -1.23]} castShadow>
        <boxGeometry args={[0.08, 1.82, 0.28]} />
        <meshStandardMaterial color="#3D2618" roughness={0.5} />
      </mesh>
      <mesh position={[1.35, 2.45, -1.23]} castShadow>
        <boxGeometry args={[0.08, 1.82, 0.28]} />
        <meshStandardMaterial color="#3D2618" roughness={0.5} />
      </mesh>
      <mesh position={[-0.15, 2.45, -1.22]} castShadow>
        <boxGeometry args={[0.042, 1.7, 0.07]} />
        <meshStandardMaterial color="#3D2618" roughness={0.5} />
      </mesh>
      <mesh position={[-0.15, 2.45, -1.22]} castShadow>
        <boxGeometry args={[2.96, 0.042, 0.07]} />
        <meshStandardMaterial color="#3D2618" roughness={0.5} />
      </mesh>

      <RainyWindowGlass
        weather={weather}
        onCycleWeather={interactionLocked ? () => {} : onCycleWeather}
        onHoverLabel={interactionLocked ? () => {} : onHoverLabel}
      />

      {/* Slim Handcrafted Walnut & Brushed-Brass Architectural Studio Nameplate */}
      <group position={[-0.15, 3.72, -1.236]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[2.08, 0.44, 0.026]} />
          <meshStandardMaterial
            map={wood.map}
            bumpMap={wood.bumpMap}
            bumpScale={0.003}
            color="#4C2F1E"
            roughness={0.56}
          />
        </mesh>

        <mesh position={[0, 0.224, 0.004]} castShadow>
          <boxGeometry args={[2.13, 0.026, 0.036]} />
          <meshStandardMaterial color="#3A2215" roughness={0.52} />
        </mesh>
        <mesh position={[0, -0.224, 0.004]} castShadow>
          <boxGeometry args={[2.13, 0.026, 0.036]} />
          <meshStandardMaterial color="#3A2215" roughness={0.52} />
        </mesh>
        <mesh position={[-1.052, 0, 0.004]} castShadow>
          <boxGeometry args={[0.026, 0.474, 0.036]} />
          <meshStandardMaterial color="#3A2215" roughness={0.52} />
        </mesh>
        <mesh position={[1.052, 0, 0.004]} castShadow>
          <boxGeometry args={[0.026, 0.474, 0.036]} />
          <meshStandardMaterial color="#3A2215" roughness={0.52} />
        </mesh>

        <mesh position={[0, 0, 0.014]}>
          <planeGeometry args={[2.04, 0.41]} />
          <meshStandardMaterial map={plaqueTexture} roughness={0.54} metalness={0.12} />
        </mesh>

        {[
          [-0.96, 0.155],
          [0.96, 0.155],
          [-0.96, -0.155],
          [0.96, -0.155],
        ].map(([px, py], idx) => (
          <mesh key={idx} position={[px, py, 0.017]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.009, 0.009, 0.007, 12]} />
            <meshStandardMaterial color="#C89B54" roughness={0.26} metalness={0.88} />
          </mesh>
        ))}
      </group>

      <ModernStudioSpeaker position={[-1.98, 1.48, -0.78]} rotationY={0.34} wood={wood} />
      <ModernStudioSpeaker position={[2.02, 1.48, -0.78]} rotationY={-0.34} wood={wood} />

      <ArticulatedDeskLamp
        lampOn={lampOn}
        locked={interactionLocked}
        onToggleLamp={onToggleLamp}
        onHoverLabel={onHoverLabel}
      />

      {/* Ceramic Coffee Mug with Outward-Curving Handle & Cork Coaster */}
      <group position={[1.76, 1.48, 0.24]} rotation={[0, -0.42, 0]}>
        <mesh position={[0, 0.004, 0]} receiveShadow>
          <cylinderGeometry args={[0.088, 0.09, 0.008, 24]} />
          <meshStandardMaterial color="#8B633F" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.076, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.066, 0.06, 0.136, 24]} />
          <meshStandardMaterial color="#F2EEE6" roughness={0.22} metalness={0.05} />
        </mesh>
        <mesh position={[0, 0.143, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.062, 0.005, 10, 24]} />
          <meshStandardMaterial color="#F2EEE6" roughness={0.2} metalness={0.05} />
        </mesh>
        <mesh position={[0.06, 0.078, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow receiveShadow>
          <torusGeometry args={[0.04, 0.0095, 12, 20, Math.PI]} />
          <meshStandardMaterial color="#F2EEE6" roughness={0.22} metalness={0.05} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1445, 0]}>
          <circleGeometry args={[0.058, 24]} />
          <meshStandardMaterial color="#381E10" roughness={0.14} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.145, 0]}>
          <ringGeometry args={[0.044, 0.055, 24]} />
          <meshStandardMaterial color="#6F4429" roughness={0.35} transparent opacity={0.45} />
        </mesh>
      </group>
    </group>
  );
}