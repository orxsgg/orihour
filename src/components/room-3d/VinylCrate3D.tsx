'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RACK_CAPACITY } from '@/data/mockVinyls';
import { VinylRecord } from '@/types/orihour';
import { createSleeveTexture, createWalnutWoodPbr, loadCorsImage } from './textures';

interface VinylCrate3DProps {
  vinyls: VinylRecord[];
  activeVinylId: string | null;
  isTransferring?: boolean;
  canShiftRack?: boolean;
  returningVinylId?: string | null;
  returnSlotTargetRef?: React.MutableRefObject<THREE.Vector3>;
  onSelectVinyl: (vinyl: VinylRecord, worldOrigin: THREE.Vector3) => void;
  onHoverLabel: (label: string | null) => void;
}

const CRATE_POS_X = -1.04;
const CRATE_POS_Y = 1.48;
const CRATE_POS_Z = -0.36;
const CRATE_ROT_Y = 0.16;
const SLEEVE_BASE_Y = 0.335;

function computeSlotStartZ(count: number): { spacing: number; startZ: number } {
  const spacing = count > 1 ? Math.min(0.095, 0.48 / (count - 1)) : 0;
  const startZ = -((count - 1) * spacing) * 0.5;
  return { spacing, startZ };
}

function buildRackIdsFromSlots(
  vinyls: VinylRecord[],
  activeVinylId: string | null
): string[] {
  const assigned = vinyls
    .filter(
      (v) =>
        v.id !== activeVinylId &&
        typeof v.rackSlot === 'number' &&
        v.rackSlot >= 1 &&
        v.rackSlot <= RACK_CAPACITY
    )
    .sort((a, b) => (b.rackSlot ?? 99) - (a.rackSlot ?? 99));

  return assigned.slice(0, RACK_CAPACITY).map((v) => v.id);
}

function RackSleeveItem({
  vinyl,
  baseZ,
  hidden,
  disabled,
  onSelect,
  onHoverLabel,
}: {
  vinyl: VinylRecord;
  baseZ: number;
  hidden: boolean;
  disabled: boolean;
  onSelect: (vinyl: VinylRecord, worldOrigin: THREE.Vector3) => void;
  onHoverLabel: (label: string | null) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [coverImg, setCoverImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    let mounted = true;
    const url = vinyl.coverUrl?.trim();
    if (!url) {
      setCoverImg(null);
      return;
    }
    loadCorsImage(url).then((img) => {
      if (mounted) setCoverImg(img);
    });
    return () => {
      mounted = false;
    };
  }, [vinyl.coverUrl]);

  const texture = useMemo(
    () => createSleeveTexture(vinyl, coverImg),
    [vinyl, coverImg]
  );

  useEffect(() => () => texture.dispose(), [texture]);

  useEffect(() => {
    if (disabled || hidden) {
      setHovered(false);
    }
  }, [disabled, hidden]);

  // Immediately seat hidden sleeves at their exact target slot so unhiding NEVER causes a jump
  useLayoutEffect(() => {
    if (hidden && meshRef.current) {
      meshRef.current.position.set(0, SLEEVE_BASE_Y, baseZ);
    }
  }, [hidden, baseZ]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    if (hidden) {
      meshRef.current.position.set(0, SLEEVE_BASE_Y, baseZ);
      return;
    }
    const dt = Math.min(delta, 0.05);
    const targetY = SLEEVE_BASE_Y + (hovered && !disabled ? 0.13 : 0);
    meshRef.current.position.y += (targetY - meshRef.current.position.y) * dt * 10;
    meshRef.current.position.z += (baseZ - meshRef.current.position.z) * dt * 9;
  });

  return (
    <mesh
      ref={meshRef}
      visible={!hidden}
      position={[0, SLEEVE_BASE_Y, baseZ]}
      rotation={[-0.08, 0, 0]}
      castShadow
      receiveShadow
      onClick={(e) => {
        if (hidden || disabled) return;
        e.stopPropagation();
        const origin = new THREE.Vector3();
        if (meshRef.current) {
          meshRef.current.getWorldPosition(origin);
        }
        onSelect(vinyl, origin);
      }}
      onPointerOver={(e) => {
        if (hidden || disabled) return;
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
        onHoverLabel(`▶ Spin Vinyl: ${vinyl.title} - ${vinyl.artist}`);
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
        onHoverLabel(null);
      }}
    >
      <boxGeometry args={[0.6, 0.6, 0.015]} />
      <meshStandardMaterial map={texture} roughness={0.4} metalness={0.05} />
    </mesh>
  );
}

export default function VinylCrate3D({
  vinyls,
  activeVinylId,
  isTransferring = false,
  canShiftRack = false,
  returningVinylId = null,
  returnSlotTargetRef,
  onSelectVinyl,
  onHoverLabel,
}: VinylCrate3DProps) {
  const wood = useMemo(() => createWalnutWoodPbr(), []);
  const prevActiveRef = useRef<string | null>(activeVinylId);

  const rackSignature = useMemo(
    () => vinyls.map((v) => `${v.id}:${v.rackSlot ?? ''}`).join('|'),
    [vinyls]
  );
  const lastSignatureRef = useRef<string>(rackSignature);

  const [rackIds, setRackIds] = useState<string[]>(() =>
    buildRackIdsFromSlots(vinyls, activeVinylId)
  );

  useEffect(() => {
    if (lastSignatureRef.current !== rackSignature) {
      lastSignatureRef.current = rackSignature;
      prevActiveRef.current = activeVinylId;
      setRackIds(buildRackIdsFromSlots(vinyls, activeVinylId));
      return;
    }

    if (isTransferring && !canShiftRack) return;

    const validIds = new Set(vinyls.map((v) => v.id));
    const prevActive = prevActiveRef.current;

    setRackIds((current) => {
      const remaining = current.filter((id) => validIds.has(id) && id !== activeVinylId);
      const next = [...remaining];

      if (
        prevActive &&
        prevActive !== activeVinylId &&
        validIds.has(prevActive) &&
        !next.includes(prevActive)
      ) {
        if (next.length >= RACK_CAPACITY) {
          next.shift();
        }
        next.unshift(prevActive);
      }

      return next.slice(0, RACK_CAPACITY);
    });

    prevActiveRef.current = activeVinylId;
  }, [activeVinylId, vinyls, rackSignature, isTransferring, canShiftRack]);

  const rackVinyls = useMemo(() => {
    const map = new Map(vinyls.map((v) => [v.id, v]));
    return rackIds.map((id) => map.get(id)).filter((v): v is VinylRecord => Boolean(v));
  }, [rackIds, vinyls]);

  const count = rackVinyls.length;
  const { spacing, startZ } = computeSlotStartZ(count);

  // Publish exact world coordinates of the backmost slot (idx 0) after swap so Turntable3D lands seamlessly
  useLayoutEffect(() => {
    if (!returnSlotTargetRef) return;

    let projectedCount = count;
    if (isTransferring && !canShiftRack && returningVinylId) {
      const activeWasInRack = activeVinylId ? rackIds.includes(activeVinylId) : false;
      const returningAlreadyInRack = rackIds.includes(returningVinylId);
      let nextLen = rackIds.length - (activeWasInRack ? 1 : 0);
      if (!returningAlreadyInRack) {
        nextLen = Math.min(RACK_CAPACITY, nextLen + 1);
      }
      projectedCount = Math.max(1, nextLen);
    }

    const { startZ: targetLocalZ } = computeSlotStartZ(projectedCount);
    const wx = CRATE_POS_X + targetLocalZ * Math.sin(CRATE_ROT_Y);
    const wy = CRATE_POS_Y + SLEEVE_BASE_Y;
    const wz = CRATE_POS_Z + targetLocalZ * Math.cos(CRATE_ROT_Y);

    returnSlotTargetRef.current.set(wx, wy, wz);
  }, [
    count,
    rackIds,
    activeVinylId,
    returningVinylId,
    isTransferring,
    canShiftRack,
    returnSlotTargetRef,
  ]);

  return (
    <group position={[CRATE_POS_X, CRATE_POS_Y, CRATE_POS_Z]} rotation={[0, CRATE_ROT_Y, 0]}>
      {/* Modern Low-Profile Walnut Base Platform */}
      <mesh position={[0, 0.016, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.66, 0.032, 0.64]} />
        <meshStandardMaterial
          map={wood.map}
          bumpMap={wood.bumpMap}
          bumpScale={0.006}
          roughness={0.44}
        />
      </mesh>

      {/* Matte-Black Minimalist Steel Side Frames */}
      {[-0.326, 0.326].map((x, idx) => (
        <group key={idx} position={[x, 0, 0]}>
          <mesh position={[0, 0.15, 0.295]} castShadow>
            <cylinderGeometry args={[0.0075, 0.0075, 0.27, 12]} />
            <meshStandardMaterial color="#17191F" roughness={0.32} metalness={0.85} />
          </mesh>
          <mesh position={[0, 0.21, -0.295]} castShadow>
            <cylinderGeometry args={[0.0075, 0.0075, 0.39, 12]} />
            <meshStandardMaterial color="#17191F" roughness={0.32} metalness={0.85} />
          </mesh>
          <mesh position={[0, 0.34, 0]} rotation={[Math.PI / 2 + 0.19, 0, 0]} castShadow>
            <cylinderGeometry args={[0.0075, 0.0075, 0.6, 12]} />
            <meshStandardMaterial color="#17191F" roughness={0.32} metalness={0.85} />
          </mesh>
          <mesh position={[0, 0.12, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.006, 0.006, 0.59, 10]} />
            <meshStandardMaterial color="#17191F" roughness={0.32} metalness={0.85} />
          </mesh>
        </group>
      ))}

      {/* Minimalist Back Support Crossbars */}
      <mesh position={[0, 0.395, -0.295]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.0075, 0.0075, 0.66, 12]} />
        <meshStandardMaterial color="#17191F" roughness={0.32} metalness={0.85} />
      </mesh>
      <mesh position={[0, 0.2, -0.295]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.0065, 0.0065, 0.66, 12]} />
        <meshStandardMaterial color="#17191F" roughness={0.32} metalness={0.85} />
      </mesh>

      {/* Brushed Brass Front Accent Trim + Clear Tempered Acrylic Front Guard */}
      <mesh position={[0, 0.038, 0.308]}>
        <boxGeometry args={[0.64, 0.011, 0.012]} />
        <meshStandardMaterial color="#C89B54" roughness={0.26} metalness={0.88} />
      </mesh>
      <mesh position={[0, 0.135, 0.308]}>
        <boxGeometry args={[0.635, 0.185, 0.008]} />
        <meshPhysicalMaterial
          color="#FFFFFF"
          transparent
          opacity={0.16}
          roughness={0.08}
          metalness={0.05}
        />
      </mesh>

      {/* Stable Ordered Vinyl Sleeves */}
      {rackVinyls.map((vinyl, idx) => (
        <RackSleeveItem
          key={vinyl.id}
          vinyl={vinyl}
          baseZ={startZ + idx * spacing}
          hidden={vinyl.id === returningVinylId || (isTransferring && vinyl.id === activeVinylId)}
          disabled={isTransferring}
          onSelect={onSelectVinyl}
          onHoverLabel={onHoverLabel}
        />
      ))}
    </group>
  );
}