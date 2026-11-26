'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { VinylRecord } from '@/types/orihour';
import {
  createSleeveTexture,
  createVinylDiscTexture,
  createWalnutWoodPbr,
  loadCorsImage,
} from './textures';

interface Turntable3DProps {
  activeVinyl: VinylRecord | null;
  previousVinyl: VinylRecord | null;
  isPlaying: boolean;
  isTransferring: boolean;
  transferOrigin: THREE.Vector3;
  returnSlotTargetRef?: React.MutableRefObject<THREE.Vector3>;
  onRackCleared: () => void;
  onTransferComplete: () => void;
  onTogglePlay: () => void;
  onOpenLinerNotes: () => void;
  onHoverLabel: (label: string | null) => void;
}

function smoothstep01(x: number): number {
  const c = Math.max(0, Math.min(1, x));
  return c * c * (3 - 2 * c);
}

function easeOutCubic(x: number): number {
  const c = Math.max(0, Math.min(1, x));
  return 1 - Math.pow(1 - c, 3);
}

function VinylDiscMesh({ texture }: { texture: THREE.CanvasTexture }) {
  return (
    <group>
      <mesh>
        <cylinderGeometry args={[0.328, 0.328, 0.008, 44]} />
        <meshStandardMaterial color="#0E1015" roughness={0.3} metalness={0.25} />
      </mesh>
      <mesh position={[0, 0.0046, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.327, 48]} />
        <meshStandardMaterial
          map={texture}
          roughness={0.26}
          metalness={0.32}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>
      <mesh position={[0, -0.0046, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.327, 48]} />
        <meshStandardMaterial
          map={texture}
          roughness={0.26}
          metalness={0.32}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>
    </group>
  );
}

export default function Turntable3D({
  activeVinyl,
  previousVinyl,
  isPlaying,
  isTransferring,
  transferOrigin,
  returnSlotTargetRef,
  onRackCleared,
  onTransferComplete,
  onTogglePlay,
  onOpenLinerNotes,
  onHoverLabel,
}: Turntable3DProps) {
  const spinningDiscRef = useRef<THREE.Group>(null);
  const spinningDiscVisualRef = useRef<THREE.Group>(null);
  const dockedSleeveAnchorRef = useRef<THREE.Group>(null);
  const dockedSleeveRef = useRef<THREE.Mesh>(null);
  const tonearmYawRef = useRef<THREE.Group>(null);
  const tonearmPitchRef = useRef<THREE.Group>(null);

  const flyingSleeveRef = useRef<THREE.Mesh>(null);
  const flyingDiscRef = useRef<THREE.Group>(null);
  const returningSleeveRef = useRef<THREE.Mesh>(null);
  const returningDiscRef = useRef<THREE.Group>(null);

  const transferProgress = useRef(0);
  const rackClearedNotified = useRef(false);
  const transferCompletedRef = useRef(false);

  const [activeCoverImg, setActiveCoverImg] = useState<HTMLImageElement | null>(null);
  const [prevCoverImg, setPrevCoverImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    let mounted = true;
    const url = activeVinyl?.coverUrl?.trim();
    if (!url) {
      setActiveCoverImg(null);
      return;
    }
    loadCorsImage(url).then((img) => {
      if (mounted) setActiveCoverImg(img);
    });
    return () => {
      mounted = false;
    };
  }, [activeVinyl?.coverUrl]);

  useEffect(() => {
    let mounted = true;
    const url = previousVinyl?.coverUrl?.trim();
    if (!url) {
      setPrevCoverImg(null);
      return;
    }
    loadCorsImage(url).then((img) => {
      if (mounted) setPrevCoverImg(img);
    });
    return () => {
      mounted = false;
    };
  }, [previousVinyl?.coverUrl]);

  const math = useMemo(
    () => ({
      endSleevePos: new THREE.Vector3(),
      endSleeveQuat: new THREE.Quaternion(),
      endDiscPos: new THREE.Vector3(),
      rackBackSlotPos: new THREE.Vector3(-1.04, 1.815, -0.36),
      rackBackAbovePos: new THREE.Vector3(-1.04, 2.48, -0.36),
      liftSleevePos: new THREE.Vector3(),
      prepSleevePos: new THREE.Vector3(-0.38, 2.16, -0.22),
      standLiftPos: new THREE.Vector3(),
      standReceivePos: new THREE.Vector3(),
      standRightDir: new THREE.Vector3(),
      oldDiscEntryPos: new THREE.Vector3(),
      oldDiscLiftControl: new THREE.Vector3(),
      returnArcControl: new THREE.Vector3(0.06, 2.58, -0.96),
      prepRightDir: new THREE.Vector3(),
      newDiscOutPos: new THREE.Vector3(),
      newDiscAbovePlatterPos: new THREE.Vector3(),
      dockArcControl: new THREE.Vector3(0.42, 2.2, -0.68),
      startSleeveQuat: new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.08, 0.16, 0, 'YXZ')),
      prepSleeveQuat: new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.05, 0.08, 0, 'YXZ')),
      discAlignRot: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)),
      flatQuat: new THREE.Quaternion(),
      oldDiscUprightQuat: new THREE.Quaternion(),
      newDiscOutQuat: new THREE.Quaternion(),
      newDiscLandQuat: new THREE.Quaternion(),
      tempVecA: new THREE.Vector3(),
      tempVecB: new THREE.Vector3(),
      yAxis: new THREE.Vector3(0, 1, 0),
    }),
    []
  );

  const wood = useMemo(() => createWalnutWoodPbr(), []);
  const discTexture = useMemo(
    () => (activeVinyl ? createVinylDiscTexture(activeVinyl) : null),
    [activeVinyl]
  );
  const sleeveTexture = useMemo(
    () => (activeVinyl ? createSleeveTexture(activeVinyl, activeCoverImg) : null),
    [activeVinyl, activeCoverImg]
  );
  const prevSleeveTexture = useMemo(
    () => (previousVinyl ? createSleeveTexture(previousVinyl, prevCoverImg) : null),
    [previousVinyl, prevCoverImg]
  );
  const prevDiscTexture = useMemo(
    () => (previousVinyl ? createVinylDiscTexture(previousVinyl) : null),
    [previousVinyl]
  );

  useEffect(() => () => discTexture?.dispose(), [discTexture]);
  useEffect(() => () => sleeveTexture?.dispose(), [sleeveTexture]);
  useEffect(() => () => prevSleeveTexture?.dispose(), [prevSleeveTexture]);
  useEffect(() => () => prevDiscTexture?.dispose(), [prevDiscTexture]);

  const tonearmCurve = useMemo(() => {
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, -0.07),
      new THREE.Vector3(0, 0, 0.12),
      new THREE.Vector3(-0.035, 0, 0.26),
      new THREE.Vector3(-0.082, 0, 0.405),
    ]);
  }, []);

  useLayoutEffect(() => {
    if (isTransferring && activeVinyl) {
      transferProgress.current = previousVinyl ? 0 : 0.24;
      rackClearedNotified.current = false;
      transferCompletedRef.current = false;

      const currentSpinY = spinningDiscRef.current ? spinningDiscRef.current.rotation.y : 0;
      math.flatQuat.setFromAxisAngle(math.yAxis, currentSpinY);

      if (spinningDiscVisualRef.current) spinningDiscVisualRef.current.visible = false;
      if (dockedSleeveRef.current) dockedSleeveRef.current.visible = false;

      if (flyingSleeveRef.current) {
        flyingSleeveRef.current.position.copy(transferOrigin);
        flyingSleeveRef.current.quaternion.copy(math.startSleeveQuat);
        flyingSleeveRef.current.visible = true;
      }
      if (flyingDiscRef.current) {
        flyingDiscRef.current.visible = false;
        flyingDiscRef.current.position.copy(transferOrigin);
      }
      if (returningSleeveRef.current && dockedSleeveAnchorRef.current && previousVinyl) {
        dockedSleeveAnchorRef.current.getWorldPosition(returningSleeveRef.current.position);
        dockedSleeveAnchorRef.current.getWorldQuaternion(returningSleeveRef.current.quaternion);
        returningSleeveRef.current.visible = true;
      }
      if (returningDiscRef.current && spinningDiscRef.current && previousVinyl) {
        spinningDiscRef.current.getWorldPosition(returningDiscRef.current.position);
        returningDiscRef.current.quaternion.copy(math.flatQuat);
        returningDiscRef.current.visible = true;
      }
    } else {
      const hasRecord = Boolean(activeVinyl);
      if (spinningDiscVisualRef.current) spinningDiscVisualRef.current.visible = hasRecord;
      if (dockedSleeveRef.current) dockedSleeveRef.current.visible = hasRecord;
      if (flyingDiscRef.current) flyingDiscRef.current.visible = false;
      if (returningDiscRef.current) returningDiscRef.current.visible = false;
      if (flyingSleeveRef.current) flyingSleeveRef.current.visible = false;
      if (returningSleeveRef.current) returningSleeveRef.current.visible = false;
    }
  }, [isTransferring, activeVinyl, previousVinyl, transferOrigin, math]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);

    if (
      isTransferring &&
      activeVinyl &&
      !transferCompletedRef.current &&
      flyingSleeveRef.current &&
      flyingDiscRef.current &&
      dockedSleeveAnchorRef.current &&
      spinningDiscRef.current
    ) {
      transferProgress.current += dt / 2.45;
      const t = Math.min(1, transferProgress.current);

      // Dynamically track the exact backmost rack slot world coordinates for ANY rack size (1..6)
      if (returnSlotTargetRef?.current) {
        math.rackBackSlotPos.copy(returnSlotTargetRef.current);
        math.rackBackAbovePos.set(
          returnSlotTargetRef.current.x,
          2.48,
          returnSlotTargetRef.current.z
        );
      }

      dockedSleeveAnchorRef.current.getWorldPosition(math.endSleevePos);
      dockedSleeveAnchorRef.current.getWorldQuaternion(math.endSleeveQuat);
      spinningDiscRef.current.getWorldPosition(math.endDiscPos);

      math.standReceivePos.set(math.endSleevePos.x, math.endSleevePos.y + 0.04, math.endSleevePos.z);
      math.standLiftPos.set(math.endSleevePos.x, 2.42, math.endSleevePos.z);
      math.standRightDir.set(1, 0, 0).applyQuaternion(math.endSleeveQuat).normalize();
      math.oldDiscEntryPos
        .copy(math.standReceivePos)
        .addScaledVector(math.standRightDir, -0.58);
      math.oldDiscUprightQuat.copy(math.endSleeveQuat).multiply(math.discAlignRot);
      math.oldDiscLiftControl.set(
        (math.endDiscPos.x + math.oldDiscEntryPos.x) * 0.5,
        Math.max(math.endDiscPos.y, math.oldDiscEntryPos.y) + 0.24,
        (math.endDiscPos.z + math.oldDiscEntryPos.z) * 0.5 + 0.06
      );

      math.liftSleevePos.set(
        transferOrigin.x,
        Math.max(transferOrigin.y + 0.58, 2.48),
        transferOrigin.z
      );

      math.prepRightDir.set(1, 0, 0).applyQuaternion(math.prepSleeveQuat).normalize();
      math.newDiscOutPos
        .copy(math.prepSleevePos)
        .addScaledVector(math.prepRightDir, 0.62);
      math.newDiscOutQuat.copy(math.prepSleeveQuat).multiply(math.discAlignRot);
      math.newDiscAbovePlatterPos.set(math.endDiscPos.x, math.endDiscPos.y + 0.28, math.endDiscPos.z);

      if (t >= 0.45 && !rackClearedNotified.current) {
        rackClearedNotified.current = true;
        onRackCleared();
      }

      if (previousVinyl && returningSleeveRef.current && returningDiscRef.current) {
        if (t < 0.26) {
          const sleeveLiftU = smoothstep01(Math.min(1, t / 0.1));
          returningSleeveRef.current.position.lerpVectors(
            math.endSleevePos,
            math.standReceivePos,
            sleeveLiftU
          );
          returningSleeveRef.current.quaternion.copy(math.endSleeveQuat);

          returningDiscRef.current.visible = true;
          if (t < 0.14) {
            const u = smoothstep01(t / 0.14);
            math.tempVecA.lerpVectors(math.endDiscPos, math.oldDiscLiftControl, u);
            math.tempVecB.lerpVectors(math.oldDiscLiftControl, math.oldDiscEntryPos, u);
            returningDiscRef.current.position.lerpVectors(math.tempVecA, math.tempVecB, u);
            returningDiscRef.current.quaternion.slerpQuaternions(
              math.flatQuat,
              math.oldDiscUprightQuat,
              u
            );
            returningDiscRef.current.scale.setScalar(1.0);
          } else {
            const u = smoothstep01((t - 0.14) / 0.12);
            returningDiscRef.current.position.lerpVectors(
              math.oldDiscEntryPos,
              math.standReceivePos,
              u
            );
            returningDiscRef.current.quaternion.copy(math.oldDiscUprightQuat);
            returningDiscRef.current.scale.setScalar(THREE.MathUtils.lerp(1.0, 0.88, u));
          }
        } else {
          returningDiscRef.current.visible = false;

          if (t < 0.42) {
            const u = smoothstep01((t - 0.26) / 0.16);
            returningSleeveRef.current.position.lerpVectors(
              math.standReceivePos,
              math.standLiftPos,
              u
            );
            returningSleeveRef.current.quaternion.copy(math.endSleeveQuat);
          } else if (t < 0.58) {
            const u = smoothstep01((t - 0.42) / 0.16);
            math.tempVecA.lerpVectors(math.standLiftPos, math.returnArcControl, u);
            math.tempVecB.lerpVectors(math.returnArcControl, math.rackBackAbovePos, u);
            returningSleeveRef.current.position.lerpVectors(math.tempVecA, math.tempVecB, u);
            returningSleeveRef.current.quaternion.slerpQuaternions(
              math.endSleeveQuat,
              math.startSleeveQuat,
              u
            );
          } else if (t < 0.72) {
            const u = easeOutCubic((t - 0.58) / 0.14);
            returningSleeveRef.current.position.lerpVectors(
              math.rackBackAbovePos,
              math.rackBackSlotPos,
              u
            );
            returningSleeveRef.current.quaternion.copy(math.startSleeveQuat);
          } else {
            returningSleeveRef.current.position.copy(math.rackBackSlotPos);
            returningSleeveRef.current.quaternion.copy(math.startSleeveQuat);
          }
        }
      }

      if (t < 0.26) {
        flyingSleeveRef.current.position.copy(transferOrigin);
        flyingSleeveRef.current.quaternion.copy(math.startSleeveQuat);
        flyingDiscRef.current.visible = false;
      } else if (t < 0.42) {
        const u = smoothstep01((t - 0.26) / 0.16);
        flyingSleeveRef.current.position.lerpVectors(transferOrigin, math.liftSleevePos, u);
        flyingSleeveRef.current.quaternion.copy(math.startSleeveQuat);
        flyingDiscRef.current.visible = false;
      } else if (t < 0.56) {
        const u = smoothstep01((t - 0.42) / 0.14);
        flyingSleeveRef.current.position.lerpVectors(math.liftSleevePos, math.prepSleevePos, u);
        flyingSleeveRef.current.quaternion.slerpQuaternions(
          math.startSleeveQuat,
          math.prepSleeveQuat,
          u
        );
        flyingDiscRef.current.visible = false;
      } else if (t < 0.8) {
        flyingSleeveRef.current.position.copy(math.prepSleevePos);
        flyingSleeveRef.current.quaternion.copy(math.prepSleeveQuat);
        flyingDiscRef.current.visible = true;

        if (t < 0.68) {
          const u = smoothstep01((t - 0.56) / 0.12);
          flyingDiscRef.current.position
            .copy(math.prepSleevePos)
            .addScaledVector(math.prepRightDir, u * 0.62);
          flyingDiscRef.current.quaternion.copy(math.newDiscOutQuat);
          flyingDiscRef.current.scale.setScalar(
            THREE.MathUtils.lerp(0.88, 1.0, Math.min(1, u * 1.5))
          );
        } else {
          const u = easeOutCubic((t - 0.68) / 0.12);
          math.tempVecA.lerpVectors(math.newDiscOutPos, math.newDiscAbovePlatterPos, u);
          math.tempVecB.lerpVectors(math.newDiscAbovePlatterPos, math.endDiscPos, u);
          flyingDiscRef.current.position.lerpVectors(math.tempVecA, math.tempVecB, u);

          math.newDiscLandQuat.setFromAxisAngle(math.yAxis, -u * Math.PI * 0.5);
          flyingDiscRef.current.quaternion.slerpQuaternions(
            math.newDiscOutQuat,
            math.newDiscLandQuat,
            smoothstep01(u * 1.2)
          );
          flyingDiscRef.current.scale.setScalar(1.0);
        }
      } else {
        const u = smoothstep01((t - 0.8) / 0.2);

        flyingDiscRef.current.visible = true;
        flyingDiscRef.current.position.copy(math.endDiscPos);
        flyingDiscRef.current.quaternion.setFromAxisAngle(math.yAxis, -Math.PI * 0.5);
        flyingDiscRef.current.scale.setScalar(1.0);

        math.tempVecA.lerpVectors(math.prepSleevePos, math.dockArcControl, u);
        math.tempVecB.lerpVectors(math.dockArcControl, math.endSleevePos, u);
        flyingSleeveRef.current.position.lerpVectors(math.tempVecA, math.tempVecB, u);
        flyingSleeveRef.current.quaternion.slerpQuaternions(
          math.prepSleeveQuat,
          math.endSleeveQuat,
          u
        );
      }

      if (t >= 1) {
        transferCompletedRef.current = true;
        spinningDiscRef.current.rotation.y = -Math.PI * 0.5;
        // Keep returningSleeveRef parked cleanly at rackBackSlotPos until React unmounts it
        // in the exact same commit that VinylCrate3D unhides RackSleeveItem (zero blink / jump!)
        if (returningSleeveRef.current && previousVinyl) {
          returningSleeveRef.current.position.copy(math.rackBackSlotPos);
          returningSleeveRef.current.quaternion.copy(math.startSleeveQuat);
        }
        flyingDiscRef.current.position.copy(math.endDiscPos);
        flyingSleeveRef.current.position.copy(math.endSleevePos);
        flyingSleeveRef.current.quaternion.copy(math.endSleeveQuat);
        onTransferComplete();
      }
    }

    const activeSpin = isPlaying && !isTransferring && Boolean(activeVinyl);

    if (spinningDiscRef.current && activeSpin) {
      spinningDiscRef.current.rotation.y -= dt * 3.49;
    }

    if (tonearmYawRef.current) {
      const targetYaw = activeSpin ? -0.44 : 0.0;
      tonearmYawRef.current.rotation.y +=
        (targetYaw - tonearmYawRef.current.rotation.y) * dt * 6.5;
    }

    if (tonearmPitchRef.current && tonearmYawRef.current) {
      const overGrooves = tonearmYawRef.current.rotation.y < -0.35;
      const targetPitch = activeSpin && overGrooves ? 0.019 : -0.055;
      tonearmPitchRef.current.rotation.x +=
        (targetPitch - tonearmPitchRef.current.rotation.x) * dt * 7.0;
    }
  });

  const hasRecord = Boolean(activeVinyl);
  const isAlbumRelease = Boolean(activeVinyl && activeVinyl.releaseType !== 'Song');

  return (
    <group>
      {/* Turntable Center-Desk (Y = 1.48) */}
      <group
        position={[0.16, 1.48, -0.34]}
        onClick={(e) => {
          e.stopPropagation();
          if (hasRecord) onTogglePlay();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = hasRecord ? 'pointer' : 'default';
          onHoverLabel(
            !hasRecord
              ? 'Turntable: Empty Platter (Pick a vinyl from the rack)'
              : isPlaying
              ? 'Turntable: Pause & Lift Needle'
              : 'Turntable: Drop Needle & Spin'
          );
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto';
          onHoverLabel(null);
        }}
      >
        {[
          [-0.45, 0.012, -0.33],
          [0.45, 0.012, -0.33],
          [-0.45, 0.012, 0.33],
          [0.45, 0.012, 0.33],
        ].map(([x, y, z], i) => (
          <mesh key={i} position={[x, y, z]} castShadow>
            <cylinderGeometry args={[0.044, 0.048, 0.024, 14]} />
            <meshStandardMaterial color="#15171C" roughness={0.55} metalness={0.35} />
          </mesh>
        ))}

        <mesh position={[0, 0.088, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.06, 0.13, 0.82]} />
          <meshStandardMaterial
            map={wood.map}
            bumpMap={wood.bumpMap}
            bumpScale={0.003}
            roughnessMap={wood.roughnessMap}
            roughness={0.58}
          />
        </mesh>

        <mesh position={[0, 0.162, 0]} receiveShadow>
          <boxGeometry args={[1.0, 0.022, 0.76]} />
          <meshStandardMaterial color="#1A1D24" roughness={0.34} metalness={0.68} />
        </mesh>

        <mesh position={[-0.14, 0.188, 0.02]} castShadow receiveShadow>
          <cylinderGeometry args={[0.345, 0.355, 0.03, 40]} />
          <meshStandardMaterial color="#D1D8E2" roughness={0.22} metalness={0.88} />
        </mesh>
        <mesh position={[-0.14, 0.205, 0.02]}>
          <cylinderGeometry args={[0.334, 0.334, 0.006, 40]} />
          <meshStandardMaterial color="#14151A" roughness={0.92} />
        </mesh>

        {/* Spinning Vinyl Record */}
        <group ref={spinningDiscRef} position={[-0.14, 0.215, 0.02]}>
          <group ref={spinningDiscVisualRef} visible={!isTransferring && Boolean(discTexture)}>
            {discTexture && <VinylDiscMesh texture={discTexture} />}
          </group>
          <mesh position={[0, 0.016, 0]}>
            <cylinderGeometry args={[0.011, 0.011, 0.034, 14]} />
            <meshStandardMaterial color="#F8FAFC" roughness={0.12} metalness={0.96} />
          </mesh>
        </group>

        <mesh position={[0.29, 0.202, 0.07]} castShadow>
          <cylinderGeometry args={[0.011, 0.013, 0.058, 12]} />
          <meshStandardMaterial color="#2C303A" roughness={0.4} metalness={0.6} />
        </mesh>

        {/* Chrome S-Tonearm Assembly with Deep Dark Maroon Headshell (#4D0F18) */}
        <group ref={tonearmYawRef} position={[0.34, 0.173, -0.22]}>
          <mesh position={[0, 0.024, 0]} castShadow>
            <cylinderGeometry args={[0.052, 0.06, 0.048, 20]} />
            <meshStandardMaterial color="#262A34" roughness={0.32} metalness={0.78} />
          </mesh>
          <mesh position={[0, 0.066, 0]} castShadow>
            <cylinderGeometry args={[0.026, 0.03, 0.044, 18]} />
            <meshStandardMaterial color="#E2E8F0" roughness={0.18} metalness={0.92} />
          </mesh>

          <group ref={tonearmPitchRef} position={[0, 0.088, 0]}>
            <mesh position={[0, 0, -0.075]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.03, 0.03, 0.05, 18]} />
              <meshStandardMaterial color="#D8DEE9" roughness={0.2} metalness={0.9} />
            </mesh>
            <mesh castShadow>
              <tubeGeometry args={[tonearmCurve, 22, 0.008, 10, false]} />
              <meshStandardMaterial color="#ECEFF4" roughness={0.16} metalness={0.95} />
            </mesh>
            {/* Dark Maroon Headshell (#4D0F18) */}
            <mesh position={[-0.088, -0.004, 0.422]} rotation={[0, -0.28, 0]} castShadow>
              <boxGeometry args={[0.032, 0.014, 0.064]} />
              <meshStandardMaterial color="#4D0F18" roughness={0.34} metalness={0.18} />
            </mesh>
            <mesh position={[-0.091, -0.016, 0.432]} rotation={[0, -0.28, 0]}>
              <boxGeometry args={[0.022, 0.014, 0.034]} />
              <meshStandardMaterial color="#18181B" roughness={0.4} metalness={0.4} />
            </mesh>
            <mesh position={[-0.094, -0.028, 0.44]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.0035, 0.014, 8]} />
              <meshStandardMaterial color="#F8FAFC" roughness={0.15} metalness={0.95} />
            </mesh>
          </group>
        </group>

        <mesh position={[0.42, 0.174, 0.14]}>
          <boxGeometry args={[0.014, 0.004, 0.22]} />
          <meshStandardMaterial color="#0A0B0E" roughness={0.8} />
        </mesh>
        <mesh position={[0.42, 0.184, 0.14]} castShadow>
          <boxGeometry args={[0.032, 0.016, 0.04]} />
          <meshStandardMaterial color="#CBD5E1" roughness={0.25} metalness={0.85} />
        </mesh>

        <mesh position={[-0.41, 0.178, 0.275]} castShadow>
          <boxGeometry args={[0.072, 0.012, 0.052]} />
          <meshStandardMaterial color="#2D323E" roughness={0.35} metalness={0.65} />
        </mesh>
        <mesh position={[-0.41, 0.186, 0.21]}>
          <sphereGeometry args={[0.012, 10, 10]} />
          <meshBasicMaterial
            color={isPlaying ? '#34D399' : hasRecord ? '#D4AA63' : '#64748B'}
          />
        </mesh>
      </group>

      {/* Now Playing Sleeve Display Stand */}
      <group
        position={[1.12, 1.48, -0.74]}
        rotation={[0, -0.28, 0]}
        onClick={(e) => {
          e.stopPropagation();
          if (hasRecord) onOpenLinerNotes();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = hasRecord ? 'pointer' : 'default';
          onHoverLabel(
            !hasRecord
              ? 'Now Playing Stand: Empty'
              : isAlbumRelease
              ? `Now Playing ${activeVinyl?.releaseType}: Open Tracklist & Liner Notes`
              : 'Now Playing Sleeve: Open Liner Notes'
          );
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto';
          onHoverLabel(null);
        }}
      >
        <mesh position={[0, 0.018, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.48, 0.036, 0.18]} />
          <meshStandardMaterial color="#422918" roughness={0.48} />
        </mesh>
        <mesh position={[0, 0.16, -0.075]} rotation={[-0.18, 0, 0]}>
          <boxGeometry args={[0.24, 0.28, 0.008]} />
          <meshStandardMaterial color="#C89B54" roughness={0.3} metalness={0.85} />
        </mesh>

        <group
          ref={dockedSleeveAnchorRef}
          position={[0, 0.325, -0.015]}
          rotation={[-0.14, 0, 0]}
        >
          {sleeveTexture && (
            <mesh ref={dockedSleeveRef} visible={!isTransferring} castShadow>
              <boxGeometry args={[0.58, 0.58, 0.015]} />
              <meshStandardMaterial map={sleeveTexture} roughness={0.4} />
            </mesh>
          )}
        </group>
      </group>

      {/* Animated Transfer Meshes */}
      {isTransferring && activeVinyl && discTexture && sleeveTexture && (
        <>
          {prevDiscTexture && (
            <group ref={returningDiscRef} visible={false}>
              <VinylDiscMesh texture={prevDiscTexture} />
            </group>
          )}

          {prevSleeveTexture && (
            <mesh ref={returningSleeveRef} castShadow>
              <boxGeometry args={[0.6, 0.6, 0.015]} />
              <meshStandardMaterial map={prevSleeveTexture} roughness={0.4} />
            </mesh>
          )}

          <mesh ref={flyingSleeveRef} castShadow>
            <boxGeometry args={[0.58, 0.58, 0.015]} />
            <meshStandardMaterial map={sleeveTexture} roughness={0.4} />
          </mesh>

          <group ref={flyingDiscRef} visible={false}>
            <VinylDiscMesh texture={discTexture} />
          </group>
        </>
      )}
    </group>
  );
}