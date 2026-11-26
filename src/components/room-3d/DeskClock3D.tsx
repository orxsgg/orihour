'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createWalnutWoodPbr, drawFlipClockFace } from './textures';

interface DeskClock3DProps {
  hourDecimal: number;
  isLiveTime: boolean;
  phaseLabel: string;
  onClickClock: () => void;
  onHoverLabel: (label: string | null) => void;
}

function createRoundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const hw = w * 0.5;
  const hh = h * 0.5;
  const s = new THREE.Shape();
  s.moveTo(-hw + r, -hh);
  s.lineTo(hw - r, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + r);
  s.lineTo(hw, hh - r);
  s.quadraticCurveTo(hw, hh, hw - r, hh);
  s.lineTo(-hw + r, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - r);
  s.lineTo(-hw, -hh + r);
  s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  s.closePath();
  return s;
}

export default function DeskClock3D({
  hourDecimal,
  isLiveTime,
  phaseLabel,
  onClickClock,
  onHoverLabel,
}: DeskClock3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const wood = useMemo(() => createWalnutWoodPbr(), []);

  const { faceCanvas, faceTexture } = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return { faceCanvas: canvas, faceTexture: tex };
  }, []);

  useEffect(() => () => faceTexture.dispose(), [faceTexture]);

  const roundedMinuteKey = Math.floor((((hourDecimal % 24) + 24) % 24) * 60);

  useEffect(() => {
    drawFlipClockFace(faceCanvas, hourDecimal, isLiveTime, phaseLabel);
    faceTexture.needsUpdate = true;
  }, [faceCanvas, faceTexture, roundedMinuteKey, isLiveTime, phaseLabel, hourDecimal]);

  const { cabinetGeo, bezelGeo } = useMemo(() => {
    // Rounded Mid-Century Walnut Case: depth 0.108 + bevel 0.008*2 => spans Z in [-0.062, +0.062]
    const bodyShape = createRoundedRectShape(0.31, 0.168, 0.022);
    const cGeo = new THREE.ExtrudeGeometry(bodyShape, {
      depth: 0.108,
      bevelEnabled: true,
      bevelThickness: 0.008,
      bevelSize: 0.007,
      bevelSegments: 4,
      curveSegments: 14,
    });
    cGeo.translate(0, 0, -0.054);

    // Brushed Brass Front Bezel Frame sitting cleanly in front of cabinet (Z = 0.0625 -> 0.0745)
    const outerFrame = createRoundedRectShape(0.28, 0.144, 0.016);
    const innerHole = createRoundedRectShape(0.254, 0.122, 0.011);
    outerFrame.holes.push(innerHole);

    const bGeo = new THREE.ExtrudeGeometry(outerFrame, {
      depth: 0.01,
      bevelEnabled: true,
      bevelThickness: 0.002,
      bevelSize: 0.0018,
      bevelSegments: 3,
      curveSegments: 12,
    });

    return { cabinetGeo: cGeo, bezelGeo: bGeo };
  }, []);

  useEffect(() => {
    return () => {
      cabinetGeo.dispose();
      bezelGeo.dispose();
    };
  }, [cabinetGeo, bezelGeo]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const dt = Math.min(delta, 0.05);
    const targetY = 1.48 + (hovered ? 0.008 : 0);
    groupRef.current.position.y += (targetY - groupRef.current.position.y) * dt * 10;
  });

  return (
    <group
      ref={groupRef}
      position={[-1.82, 1.48, 0.18]}
      rotation={[0, 0.36, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onClickClock();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
        onHoverLabel('Flip Clock: Scrub Time of Day');
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
        onHoverLabel(null);
      }}
    >
      {/* Turned Brushed-Brass Stabilizer Feet */}
      {[
        [-0.105, 0.009, 0.028],
        [0.105, 0.009, 0.028],
        [-0.105, 0.009, -0.032],
        [0.105, 0.009, -0.032],
      ].map(([fx, fy, fz], idx) => (
        <mesh key={idx} position={[fx, fy, fz]} castShadow receiveShadow>
          <cylinderGeometry args={[0.011, 0.014, 0.018, 16]} />
          <meshStandardMaterial color="#C89B54" roughness={0.28} metalness={0.88} />
        </mesh>
      ))}

      {/* Subtle Ergonomic Upward-Tilted Walnut Clock Body */}
      <group position={[0, 0.106, 0]} rotation={[-0.1, 0, 0]}>
        {/* Sculpted Walnut Wood Cabinet */}
        <mesh geometry={cabinetGeo} castShadow receiveShadow>
          <meshStandardMaterial
            map={wood.map}
            bumpMap={wood.bumpMap}
            bumpScale={0.0025}
            roughnessMap={wood.roughnessMap}
            color="#5B3823"
            roughness={0.56}
          />
        </mesh>

        {/* Matte Espresso Front Cavity Backer cleanly IN FRONT of cabinet face (z = 0.063) */}
        <mesh position={[0, 0, 0.063]}>
          <planeGeometry args={[0.274, 0.138]} />
          <meshStandardMaterial color="#1A120D" roughness={0.62} />
        </mesh>

        {/* Warm Backlit Mechanical Split-Flip Dial cleanly visible at z = 0.0648 */}
        <mesh position={[0, 0, 0.0648]}>
          <planeGeometry args={[0.252, 0.121]} />
          <meshStandardMaterial
            map={faceTexture}
            roughness={0.34}
            metalness={0.04}
            emissive="#FFF1D6"
            emissiveMap={faceTexture}
            emissiveIntensity={0.62}
          />
        </mesh>

        {/* Brushed-Brass Front Rim Bezel framing the backlit dial */}
        <mesh geometry={bezelGeo} position={[0, 0, 0.0625]} castShadow>
          <meshStandardMaterial color="#C89B54" roughness={0.28} metalness={0.86} />
        </mesh>

        {/* Protective Clear Glass Face Lens inside outer bezel rim */}
        <mesh position={[0, 0, 0.0725]}>
          <planeGeometry args={[0.256, 0.124]} />
          <meshPhysicalMaterial
            color="#FFFBF5"
            transparent
            opacity={0.07}
            roughness={0.06}
            metalness={0.04}
            clearcoat={0.85}
            clearcoatRoughness={0.08}
            depthWrite={false}
          />
        </mesh>

        {/* Top Brushed-Brass Snooze / Ambient Light Bar */}
        <mesh position={[0, 0.095, -0.004]} castShadow>
          <boxGeometry args={[0.108, 0.011, 0.026]} />
          <meshStandardMaterial color="#D4AA63" roughness={0.24} metalness={0.9} />
        </mesh>

        {/* Right-Side Knurled Brass Time-Scrubbing Rotary Dial */}
        <group position={[0.168, -0.004, 0.005]} rotation={[0, 0, Math.PI / 2]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.022, 0.024, 0.016, 24]} />
            <meshStandardMaterial color="#C89B54" roughness={0.28} metalness={0.88} />
          </mesh>
          <mesh position={[0, 0.009, 0]}>
            <cylinderGeometry args={[0.017, 0.017, 0.003, 24]} />
            <meshStandardMaterial color="#3B2314" roughness={0.5} />
          </mesh>
        </group>

        {/* Back Brass Vent Plate Detail */}
        <mesh position={[0, 0, -0.0635]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[0.22, 0.1]} />
          <meshStandardMaterial color="#231710" roughness={0.65} />
        </mesh>
      </group>
    </group>
  );
}