'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { VinylRecord } from '@/types/orihour';
import { createLeatherPbr, createNotepadTexture } from './textures';

interface DeskNotepad3DProps {
  activeVinyl: VinylRecord | null;
  isPlaying: boolean;
  onFocusNotepad: () => void;
  onHoverLabel: (label: string | null) => void;
}

/**
 * Builds a gravity-draped satin silk bookmark ribbon with a classic swallowtail V-notch.
 * Emerges between the page layers, settles gently onto the walnut desktop, and naturally
 * bends downward 90 degrees over the front edge of the desk (local Z ≈ 0.353) under gravity.
 */
function buildNaturalRibbonGeometry(): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(0.036, 0.0205, 0.24),   // Tucked cleanly between page layers
      new THREE.Vector3(0.041, 0.0202, 0.262),  // Clears the archival page block edge
      new THREE.Vector3(0.049, 0.0155, 0.278),  // Drops smoothly off the leather cover lip
      new THREE.Vector3(0.059, 0.0042, 0.295),  // Settles down onto walnut desk surface
      new THREE.Vector3(0.068, 0.0022, 0.324),  // Rests flat along the desktop
      new THREE.Vector3(0.075, 0.0018, 0.348),  // Approaches the front desk edge (Z_world ≈ 0.40)
      new THREE.Vector3(0.078, -0.0065, 0.362), // Bends smoothly over the front walnut edge
      new THREE.Vector3(0.08, -0.028, 0.366),   // Hangs downward along gravity
      new THREE.Vector3(0.079, -0.056, 0.365),  // Soft vertical drape below desk lip
      new THREE.Vector3(0.077, -0.084, 0.364),  // Gravity-weighted swallowtail end
    ],
    false,
    'centripetal',
    0.5
  );

  const segments = 40;
  const halfWidth = 0.0115;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    const p = curve.getPoint(u);
    const tan = curve.getTangent(u).normalize();

    // Gram-Schmidt orthogonalization against local +X keeps ribbon flat across horizontal AND vertical drape
    const baseRight = new THREE.Vector3(1, 0, -0.06).normalize();
    const right = baseRight
      .clone()
      .addScaledVector(tan, -baseRight.dot(tan))
      .normalize();

    const leftPt = p.clone().addScaledVector(right, -halfWidth);
    const centerPt = p.clone();
    const rightPt = p.clone().addScaledVector(right, halfWidth);

    // Classic V-notched swallowtail cut at the hanging tip
    if (i === segments) {
      centerPt.addScaledVector(tan, -0.013);
    }

    positions.push(
      leftPt.x, leftPt.y, leftPt.z,
      centerPt.x, centerPt.y, centerPt.z,
      rightPt.x, rightPt.y, rightPt.z
    );
    uvs.push(0, u, 0.5, u, 1, u);

    if (i < segments) {
      const b = i * 3;
      const n = (i + 1) * 3;
      indices.push(b, n, b + 1);
      indices.push(b + 1, n, n + 1);
      indices.push(b + 1, n + 1, b + 2);
      indices.push(b + 2, n + 1, n + 2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export default function DeskNotepad3D({
  activeVinyl,
  isPlaying,
  onFocusNotepad,
  onHoverLabel,
}: DeskNotepad3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const pageTexture = useMemo(
    () => createNotepadTexture(activeVinyl, isPlaying),
    [activeVinyl, isPlaying]
  );

  useEffect(() => () => pageTexture.dispose(), [pageTexture]);

  const leather = useMemo(() => createLeatherPbr(), []);

  const { coverGeo, ribbonGeo } = useMemo(() => {
    const w = 0.43;
    const h = 0.55;
    const r = 0.016;
    const shape = new THREE.Shape();
    shape.moveTo(-w * 0.5 + r, -h * 0.5);
    shape.lineTo(w * 0.5 - r, -h * 0.5);
    shape.quadraticCurveTo(w * 0.5, -h * 0.5, w * 0.5, -h * 0.5 + r);
    shape.lineTo(w * 0.5, h * 0.5 - r);
    shape.quadraticCurveTo(w * 0.5, h * 0.5, w * 0.5 - r, h * 0.5);
    shape.lineTo(-w * 0.5 + 0.006, h * 0.5);
    shape.quadraticCurveTo(-w * 0.5, h * 0.5, -w * 0.5, h * 0.5 - 0.006);
    shape.lineTo(-w * 0.5, -h * 0.5 + 0.006);
    shape.quadraticCurveTo(-w * 0.5, -h * 0.5, -w * 0.5 + 0.006, -h * 0.5);
    shape.closePath();

    const cGeo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.008,
      bevelEnabled: true,
      bevelThickness: 0.0022,
      bevelSize: 0.0022,
      bevelSegments: 3,
      curveSegments: 12,
    });
    cGeo.rotateX(-Math.PI / 2);

    return { coverGeo: cGeo, ribbonGeo: buildNaturalRibbonGeometry() };
  }, []);

  useEffect(() => {
    return () => {
      coverGeo.dispose();
      ribbonGeo.dispose();
    };
  }, [coverGeo, ribbonGeo]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const dt = Math.min(delta, 0.05);
    const targetY = 1.48 + (hovered ? 0.007 : 0);
    groupRef.current.position.y += (targetY - groupRef.current.position.y) * dt * 10;
  });

  return (
    <group
      ref={groupRef}
      position={[1.18, 1.48, 0.04]}
      rotation={[0, -0.14, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onFocusNotepad();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
        onHoverLabel(
          activeVinyl
            ? 'Listening Journal: Zoom & Read Liner Notes'
            : 'Listening Journal: Standby (Empty Platter)'
        );
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
        onHoverLabel(null);
      }}
    >
      {/* Hardcover Deep Burgundy Pebbled Leather Back Board */}
      <mesh geometry={coverGeo} position={[0, 0.0022, 0]} castShadow receiveShadow>
        <meshStandardMaterial
          map={leather.map}
          bumpMap={leather.bumpMap}
          bumpScale={0.003}
          roughnessMap={leather.roughnessMap}
          color="#5C1826"
          roughness={0.64}
        />
      </mesh>

      {/* Rounded Leather Book Spine along Left Edge with Antique Brass Bands */}
      <mesh position={[-0.214, 0.017, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.017, 0.017, 0.548, 14]} />
        <meshStandardMaterial
          map={leather.map}
          bumpMap={leather.bumpMap}
          bumpScale={0.003}
          color="#4E1420"
          roughness={0.62}
        />
      </mesh>
      {[-0.2, 0.0, 0.2].map((bz, idx) => (
        <mesh key={idx} position={[-0.214, 0.017, bz]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.0176, 0.0176, 0.01, 14]} />
          <meshStandardMaterial color="#C89B54" roughness={0.3} metalness={0.86} />
        </mesh>
      ))}

      {/* Lower Half of Cream Archival Page Block */}
      <mesh position={[0.004, 0.0155, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.398, 0.009, 0.518]} />
        <meshStandardMaterial color="#E0D5C2" roughness={0.92} />
      </mesh>

      {/* Upper Half of Cream Archival Page Block resting over the tucked bookmark */}
      <mesh position={[0.004, 0.0255, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.398, 0.009, 0.518]} />
        <meshStandardMaterial color="#E8DFCE" roughness={0.9} />
      </mesh>

      {/* Subtle Secondary Offset Sheet Layer */}
      <mesh position={[0.006, 0.0303, 0.001]} rotation={[0, 0.005, 0]} receiveShadow>
        <boxGeometry args={[0.396, 0.0014, 0.516]} />
        <meshStandardMaterial color="#EFE7D8" roughness={0.92} />
      </mesh>

      {/* Top Printed Archival Stationery Page */}
      <mesh
        position={[0.005, 0.0314, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[0.394, 0.514]} />
        <meshStandardMaterial
          map={pageTexture}
          roughness={0.86}
          metalness={0.0}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>

      {/* Gravity-Draped Burgundy Silk Ribbon Bookmark */}
      <mesh geometry={ribbonGeo} castShadow receiveShadow>
        <meshStandardMaterial
          color="#7C1E30"
          roughness={0.56}
          metalness={0.08}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Brass Corner Protectors on Right Corners of Leather Hardcover */}
      {[
        [0.206, 0.264],
        [0.206, -0.264],
      ].map(([cx, cz], idx) => (
        <mesh key={idx} position={[cx, 0.007, cz]}>
          <boxGeometry args={[0.022, 0.013, 0.022]} />
          <meshStandardMaterial color="#C89B54" roughness={0.28} metalness={0.88} />
        </mesh>
      ))}

      {/* Burgundy Lacquer & Brushed-Brass Fountain Pen Resting Beside the Journal */}
      <group position={[0.275, 0.011, 0.04]} rotation={[0, 0.16, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.0085, 0.0075, 0.25, 14]} />
          <meshStandardMaterial color="#5E1725" roughness={0.26} metalness={0.25} />
        </mesh>
        <mesh position={[0, 0, -0.025]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.0092, 0.0092, 0.014, 14]} />
          <meshStandardMaterial color="#D4AA63" roughness={0.22} metalness={0.92} />
        </mesh>
        <mesh position={[0, 0, 0.13]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.0075, 0.0055, 0.014, 12]} />
          <meshStandardMaterial color="#C89B54" roughness={0.25} metalness={0.9} />
        </mesh>
        <mesh position={[0, 0, -0.14]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.0052, 0.0082, 0.034, 12]} />
          <meshStandardMaterial color="#1B1715" roughness={0.45} metalness={0.3} />
        </mesh>
        <mesh position={[0, 0, -0.172]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.0048, 0.032, 10]} />
          <meshStandardMaterial color="#DFBA74" roughness={0.2} metalness={0.95} />
        </mesh>
        <mesh position={[0.0095, 0.004, 0.038]}>
          <boxGeometry args={[0.0022, 0.0026, 0.092]} />
          <meshStandardMaterial color="#D4AA63" roughness={0.24} metalness={0.92} />
        </mesh>
      </group>
    </group>
  );
}