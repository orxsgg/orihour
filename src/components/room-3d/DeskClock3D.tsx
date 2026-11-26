'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { drawFlipClockFace } from './textures';

interface DeskClock3DProps {
  hourDecimal: number;
  isLiveTime: boolean;
  phaseLabel: string;
  onClickClock: () => void;
  onHoverLabel: (label: string | null) => void;
}

export default function DeskClock3D({
  hourDecimal,
  isLiveTime,
  phaseLabel,
  onClickClock,
  onHoverLabel,
}: DeskClock3DProps) {
  const lastMinuteKey = useRef<string>('');

  const { canvas, texture } = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return { canvas: c, texture: tex };
  }, []);

  useEffect(() => {
    const totalMins = Math.floor((((hourDecimal % 24) + 24) % 24) * 60);
    const key = `${totalMins}_${isLiveTime}_${phaseLabel}`;
    if (lastMinuteKey.current !== key) {
      lastMinuteKey.current = key;
      drawFlipClockFace(canvas, hourDecimal, isLiveTime, phaseLabel);
      texture.needsUpdate = true;
    }
  }, [hourDecimal, isLiveTime, phaseLabel, canvas, texture]);

  return (
    <group
      position={[-1.82, 1.48, 0.18]}
      rotation={[0, 0.32, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onClickClock();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
        onHoverLabel('Flip Clock: Adjust Hour / Sync Live');
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto';
        onHoverLabel(null);
      }}
    >
      {/* Matte Anodized Aluminum Body */}
      <mesh position={[0, 0.115, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.42, 0.21, 0.12]} />
        <meshStandardMaterial color="#D4D8DF" roughness={0.28} metalness={0.76} />
      </mesh>
      {/* Subtle Dark Recessed Bezel */}
      <mesh position={[0, 0.115, 0.058]}>
        <boxGeometry args={[0.395, 0.185, 0.01]} />
        <meshStandardMaterial color="#0F1116" roughness={0.5} />
      </mesh>
      {/* Rubber Base Pad */}
      <mesh position={[0, 0.008, 0]}>
        <boxGeometry args={[0.38, 0.016, 0.105]} />
        <meshStandardMaterial color="#181A20" roughness={0.85} />
      </mesh>
      {/* Flip Display Face */}
      <mesh position={[0, 0.115, 0.064]}>
        <planeGeometry args={[0.38, 0.172]} />
        <meshBasicMaterial map={texture} />
      </mesh>
    </group>
  );
}