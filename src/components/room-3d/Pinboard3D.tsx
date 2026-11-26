'use client';

import React, { useEffect, useMemo } from 'react';
import { GuestbookPostcard, MAX_PINBOARD_VISIBLE } from '@/types/orihour';
import { createCorkboardTexture, createPostcardTexture, createWalnutWoodPbr } from './textures';

interface Pinboard3DProps {
  postcards?: GuestbookPostcard[];
  onClickPinboard?: () => void;
  onHoverLabel: (label: string | null) => void;
}

const CARD_SLOTS: { pos: [number, number, number]; tilt: number }[] = [
  { pos: [-0.54, 0.24, 0.032], tilt: 0.045 },
  { pos: [0.0, 0.25, 0.033], tilt: -0.025 },
  { pos: [0.54, 0.23, 0.032], tilt: 0.035 },
  { pos: [-0.52, -0.24, 0.033], tilt: -0.04 },
  { pos: [0.02, -0.25, 0.032], tilt: 0.03 },
  { pos: [0.53, -0.24, 0.033], tilt: -0.035 },
];

function PinnedPostcardMesh({
  postcard,
  slot,
}: {
  postcard: GuestbookPostcard;
  slot: { pos: [number, number, number]; tilt: number };
}) {
  const cardTexture = useMemo(() => createPostcardTexture(postcard), [postcard]);

  useEffect(() => () => cardTexture.dispose(), [cardTexture]);

  const pinColor =
    postcard.pinColor && postcard.pinColor.toUpperCase() !== '#D94E28'
      ? postcard.pinColor
      : '#4A2E1B';

  return (
    <group position={slot.pos} rotation={[0, 0, slot.tilt]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.48, 0.34, 0.008]} />
        <meshStandardMaterial color="#EFE6D5" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0, 0.005]}>
        <planeGeometry args={[0.47, 0.33]} />
        <meshStandardMaterial map={cardTexture} roughness={0.78} />
      </mesh>
      <mesh position={[0, 0.135, 0.014]} castShadow>
        <sphereGeometry args={[0.015, 10, 10]} />
        <meshStandardMaterial color={pinColor} roughness={0.28} metalness={0.15} />
      </mesh>
      <mesh position={[0, 0.135, 0.007]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.003, 0.003, 0.014, 8]} />
        <meshStandardMaterial color="#CBD5E1" metalness={0.9} roughness={0.2} />
      </mesh>
    </group>
  );
}

export default function Pinboard3D({
  postcards = [],
  onClickPinboard,
  onHoverLabel,
}: Pinboard3DProps) {
  const cork = useMemo(() => createCorkboardTexture(), []);
  const wood = useMemo(() => createWalnutWoodPbr(), []);
  const visiblePostcards = Array.isArray(postcards)
    ? postcards.slice(0, Math.min(CARD_SLOTS.length, MAX_PINBOARD_VISIBLE))
    : [];

  return (
    <group
      position={[3.62, 2.34, 0.95]}
      rotation={[0, -Math.PI / 2, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onClickPinboard?.();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
        onHoverLabel('Visitor Pinboard: View & Pin Song Postcards');
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto';
        onHoverLabel(null);
      }}
    >
      <mesh position={[0, 0, 0.012]} receiveShadow castShadow>
        <boxGeometry args={[1.76, 1.12, 0.024]} />
        <meshStandardMaterial
          map={cork.map}
          bumpMap={cork.bumpMap}
          bumpScale={0.012}
          roughness={0.92}
        />
      </mesh>

      <mesh position={[0, 0.59, 0.022]} castShadow>
        <boxGeometry args={[1.88, 0.06, 0.048]} />
        <meshStandardMaterial map={wood.map} roughness={0.48} />
      </mesh>
      <mesh position={[0, -0.59, 0.022]} castShadow>
        <boxGeometry args={[1.88, 0.06, 0.048]} />
        <meshStandardMaterial map={wood.map} roughness={0.48} />
      </mesh>
      <mesh position={[-0.91, 0, 0.022]} castShadow>
        <boxGeometry args={[0.06, 1.12, 0.048]} />
        <meshStandardMaterial map={wood.map} roughness={0.48} />
      </mesh>
      <mesh position={[0.91, 0, 0.022]} castShadow>
        <boxGeometry args={[0.06, 1.12, 0.048]} />
        <meshStandardMaterial map={wood.map} roughness={0.48} />
      </mesh>

      {[
        [-0.91, 0.59],
        [0.91, 0.59],
        [-0.91, -0.59],
        [0.91, -0.59],
      ].map(([cx, cy], idx) => (
        <mesh key={idx} position={[cx, cy, 0.048]}>
          <boxGeometry args={[0.055, 0.055, 0.006]} />
          <meshStandardMaterial color="#C89B54" roughness={0.28} metalness={0.86} />
        </mesh>
      ))}

      <mesh position={[0, 0.59, 0.048]}>
        <boxGeometry args={[0.42, 0.036, 0.008]} />
        <meshStandardMaterial color="#C89B54" roughness={0.26} metalness={0.88} />
      </mesh>

      {visiblePostcards.map((pc, idx) => (
        <PinnedPostcardMesh key={pc.id} postcard={pc} slot={CARD_SLOTS[idx]} />
      ))}
    </group>
  );
}