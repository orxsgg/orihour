'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { OwnerProfile } from '@/types/orihour';
import {
  createIdentityCardTexture,
  createLeatherPbr,
  createWalletCoverTexture,
  createWalletInteriorTexture,
} from './textures';

interface DeskWallet3DProps {
  owner: OwnerProfile;
  isOpen: boolean;
  onOpenWallet: () => void;
  onHoverLabel: (label: string | null) => void;
}

function easeInOutCubic(x: number): number {
  const c = Math.max(0, Math.min(1, x));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

function smoothstepRange(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function normalizeShapeUVs(
  geo: THREE.BufferGeometry,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number
) {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const uvs = new Float32Array(pos.count * 2);
  const dx = Math.max(0.0001, maxX - minX);
  const dy = Math.max(0.0001, maxY - minY);
  for (let i = 0; i < pos.count; i++) {
    uvs[i * 2] = (pos.getX(i) - minX) / dx;
    uvs[i * 2 + 1] = (pos.getY(i) - minY) / dy;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
}

function createCleanRoundedShape(
  x: number,
  y: number,
  w: number,
  h: number,
  rTL: number,
  rTR: number,
  rBR: number,
  rBL: number
): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(x + rBL, y);
  s.lineTo(x + w - rBR, y);
  s.quadraticCurveTo(x + w, y, x + w, y + rBR);
  s.lineTo(x + w, y + h - rTR);
  s.quadraticCurveTo(x + w, y + h, x + w - rTR, y + h);
  s.lineTo(x + rTL, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - rTL);
  s.lineTo(x, y + rBL);
  s.quadraticCurveTo(x, y, x + rBL, y);
  s.closePath();
  return s;
}

function createScallopedPocketShape(w: number, h: number, dipDepth = 0.0085): THREE.Shape {
  const hw = w * 0.5;
  const hh = h * 0.5;
  const r = 0.008;
  const s = new THREE.Shape();

  s.moveTo(-hw + r, -hh);
  s.lineTo(hw - r, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + r);
  s.lineTo(hw, hh - 0.003);
  s.quadraticCurveTo(hw, hh, hw - 0.004, hh);
  s.lineTo(hw * 0.42, hh);
  s.bezierCurveTo(hw * 0.22, hh, hw * 0.16, hh - dipDepth, 0, hh - dipDepth);
  s.bezierCurveTo(-hw * 0.16, hh - dipDepth, -hw * 0.22, hh, -hw * 0.42, hh);
  s.lineTo(-hw + 0.004, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - 0.003);
  s.lineTo(-hw, -hh + r);
  s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  s.closePath();
  return s;
}

/**
 * Concave (cekung) leather spine bridge along the center back fold of an open bifold wallet.
 */
function createConcaveSpineGeometry(height: number): THREE.BufferGeometry {
  const halfW = 0.0145;
  const outerEdgeBack = 0.0102;
  const centerConcaveBack = 0.0046;
  const innerEdgeFront = 0.0014;
  const centerFront = 0.0005;

  const profile = new THREE.Shape();
  profile.moveTo(-halfW, outerEdgeBack);
  profile.bezierCurveTo(
    -halfW * 0.48,
    outerEdgeBack,
    -halfW * 0.36,
    centerConcaveBack,
    0,
    centerConcaveBack
  );
  profile.bezierCurveTo(
    halfW * 0.36,
    centerConcaveBack,
    halfW * 0.48,
    outerEdgeBack,
    halfW,
    outerEdgeBack
  );
  profile.lineTo(halfW, innerEdgeFront);
  profile.quadraticCurveTo(0, centerFront, -halfW, innerEdgeFront);
  profile.closePath();

  const extrudeH = height - 0.004;
  const geo = new THREE.ExtrudeGeometry(profile, {
    depth: extrudeH,
    bevelEnabled: true,
    bevelThickness: 0.0014,
    bevelSize: 0.0012,
    bevelSegments: 3,
    curveSegments: 18,
  });

  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -extrudeH * 0.5, 0);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Supple rounded C-fold spine wrapping the folded edge when the wallet is closed.
 */
function createClosedFoldSpineGeometry(height: number): THREE.BufferGeometry {
  const extrudeH = height - 0.005;
  const profile = new THREE.Shape();
  profile.moveTo(0.008, 0.0102);
  profile.bezierCurveTo(-0.008, 0.0102, -0.0105, 0.002, -0.0105, -0.0045);
  profile.bezierCurveTo(-0.0105, -0.011, -0.008, -0.0192, 0.008, -0.0192);
  profile.lineTo(0.008, -0.0138);
  profile.bezierCurveTo(-0.003, -0.0138, -0.0045, -0.008, -0.0045, -0.0045);
  profile.bezierCurveTo(-0.0045, -0.001, -0.003, 0.0048, 0.008, 0.0048);
  profile.closePath();

  const geo = new THREE.ExtrudeGeometry(profile, {
    depth: extrudeH,
    bevelEnabled: true,
    bevelThickness: 0.0014,
    bevelSize: 0.0012,
    bevelSegments: 3,
    curveSegments: 16,
  });

  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -extrudeH * 0.5, 0);
  geo.computeVertexNormals();
  return geo;
}

export default function DeskWallet3D({
  owner,
  isOpen,
  onOpenWallet,
  onHoverLabel,
}: DeskWallet3DProps) {
  const rootRef = useRef<THREE.Group>(null);
  const centerShiftRef = useRef<THREE.Group>(null);
  const leftFlapPivotRef = useRef<THREE.Group>(null);
  const openSpineRef = useRef<THREE.Mesh>(null);
  const closedSpineRef = useRef<THREE.Mesh>(null);

  const openAnim = useRef(0);
  const hoverLiftRef = useRef(0);
  const [hovered, setHovered] = useState(false);
  const [avatarImg, setAvatarImg] = useState<HTMLImageElement | null>(null);

  // Always clear hover state when wallet opens or closes so it never pops up on landing
  useEffect(() => {
    setHovered(false);
  }, [isOpen]);

  useEffect(() => {
    if (!owner.avatarUrl?.trim()) {
      setAvatarImg(null);
      return;
    }
    let active = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (active) setAvatarImg(img);
    };
    img.onerror = () => {
      if (active) setAvatarImg(null);
    };
    img.src = owner.avatarUrl.trim();
    return () => {
      active = false;
    };
  }, [owner.avatarUrl]);

  const leather = useMemo(() => createLeatherPbr(), []);
  const frontCoverTex = useMemo(() => createWalletCoverTexture('ORIHOUR'), []);
  const backCoverTex = useMemo(() => createWalletCoverTexture(''), []);
  const leftIntTex = useMemo(() => createWalletInteriorTexture('left'), []);
  const rightIntTex = useMemo(() => createWalletInteriorTexture('right'), []);
  const idCardTex = useMemo(
    () => createIdentityCardTexture(owner, avatarImg),
    [owner, avatarImg]
  );

  useEffect(() => () => idCardTex.dispose(), [idCardTex]);

  const W = 0.222;
  const H = 0.168;

  const geos = useMemo(() => {
    const outerR = 0.015;
    const innerR = 0.004;
    const spineHalfGap = 0.0075;

    const rightShape = createCleanRoundedShape(
      spineHalfGap,
      -H * 0.5,
      W - spineHalfGap,
      H,
      innerR,
      outerR,
      outerR,
      innerR
    );
    const leftShape = createCleanRoundedShape(
      -W,
      -H * 0.5,
      W - spineHalfGap,
      H,
      outerR,
      innerR,
      innerR,
      outerR
    );

    const panelExtrude = {
      depth: 0.0064,
      bevelEnabled: true,
      bevelThickness: 0.0018,
      bevelSize: 0.0018,
      bevelSegments: 4,
      curveSegments: 14,
    };

    const rightPanelGeo = new THREE.ExtrudeGeometry(rightShape, panelExtrude);
    const leftPanelGeo = new THREE.ExtrudeGeometry(leftShape, panelExtrude);

    const rightFaceGeo = new THREE.ShapeGeometry(rightShape, 14);
    normalizeShapeUVs(rightFaceGeo, spineHalfGap, W, -H * 0.5, H * 0.5);

    const leftFaceGeo = new THREE.ShapeGeometry(leftShape, 14);
    normalizeShapeUVs(leftFaceGeo, -W, -spineHalfGap, -H * 0.5, H * 0.5);

    const frameW = W - 0.016;
    const frameH = H - 0.014;
    const frameShape = createCleanRoundedShape(
      0.009,
      -frameH * 0.5,
      frameW,
      frameH,
      0.004,
      0.012,
      0.012,
      0.004
    );

    const winW = 0.176;
    const winH = 0.112;
    const winX = 0.009 + (frameW - winW) * 0.5;
    const winY = -winH * 0.5;
    const hole = new THREE.Path();
    const hr = 0.008;
    hole.moveTo(winX + hr, winY);
    hole.lineTo(winX + winW - hr, winY);
    hole.quadraticCurveTo(winX + winW, winY, winX + winW, winY + hr);
    hole.lineTo(winX + winW, winY + winH - hr);
    hole.quadraticCurveTo(winX + winW, winY + winH, winX + winW - hr, winY + winH);
    hole.lineTo(winX + hr, winY + winH);
    hole.quadraticCurveTo(winX, winY + winH, winX, winY + winH - hr);
    hole.lineTo(winX, winY + hr);
    hole.quadraticCurveTo(winX, winY, winX + hr, winY);
    hole.closePath();
    frameShape.holes.push(hole);

    const idWindowFrameGeo = new THREE.ExtrudeGeometry(frameShape, {
      depth: 0.0022,
      bevelEnabled: true,
      bevelThickness: 0.001,
      bevelSize: 0.001,
      bevelSegments: 3,
      curveSegments: 14,
    });

    const pocketShape = createScallopedPocketShape(W - 0.028, 0.044, 0.008);
    const pocketGeo = new THREE.ExtrudeGeometry(pocketShape, {
      depth: 0.0016,
      bevelEnabled: true,
      bevelThickness: 0.0008,
      bevelSize: 0.0008,
      bevelSegments: 3,
      curveSegments: 14,
    });

    const bottomPocketShape = createScallopedPocketShape(W - 0.028, 0.04, 0.006);
    const bottomPocketGeo = new THREE.ExtrudeGeometry(bottomPocketShape, {
      depth: 0.0016,
      bevelEnabled: true,
      bevelThickness: 0.0008,
      bevelSize: 0.0008,
      bevelSegments: 3,
      curveSegments: 14,
    });

    const cardShape = createCleanRoundedShape(
      -0.082,
      -0.022,
      0.164,
      0.044,
      0.007,
      0.007,
      0.007,
      0.007
    );
    const cardGeo = new THREE.ExtrudeGeometry(cardShape, {
      depth: 0.0012,
      bevelEnabled: false,
      curveSegments: 10,
    });

    const idCardShape = createCleanRoundedShape(
      -0.092,
      -0.0595,
      0.184,
      0.119,
      0.007,
      0.007,
      0.007,
      0.007
    );
    const idCardGeo = new THREE.ShapeGeometry(idCardShape, 12);
    normalizeShapeUVs(idCardGeo, -0.092, 0.092, -0.0595, 0.0595);

    const concaveSpineGeo = createConcaveSpineGeometry(H);
    const closedSpineGeo = createClosedFoldSpineGeometry(H);

    return {
      rightPanelGeo,
      leftPanelGeo,
      rightFaceGeo,
      leftFaceGeo,
      idWindowFrameGeo,
      pocketGeo,
      bottomPocketGeo,
      cardGeo,
      idCardGeo,
      concaveSpineGeo,
      closedSpineGeo,
    };
  }, [W, H]);

  const math = useMemo(
    () => ({
      closedPos: new THREE.Vector3(-0.56, 1.494, 0.22),
      openPos: new THREE.Vector3(-0.52, 1.97, 0.38),
      closedQuat: new THREE.Quaternion().setFromEuler(
        new THREE.Euler(-Math.PI / 2, 0.28, 0, 'YXZ')
      ),
      openQuat: new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.14, 0, 0, 'YXZ')),
    }),
    []
  );

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.045);

    if (isOpen && openAnim.current < 1) {
      openAnim.current = Math.min(1, openAnim.current + dt / 0.92);
    } else if (!isOpen && openAnim.current > 0) {
      openAnim.current = Math.max(0, openAnim.current - dt / 0.88);
    }

    const p = openAnim.current;

    // Symmetric easeInOutCubic for both lift and hinge:
    // Opening: lifts smoothly first, then unfolds gracefully.
    // Closing: folds shut cleanly first (zero end-slam), then sets gently onto the walnut desk.
    const liftT = easeInOutCubic(Math.min(1, p / 0.72));
    const hingeT = easeInOutCubic(Math.max(0, (p - 0.22) / 0.78));

    // Smoothly damped hover lift (eliminates any 1-frame snap when landing on the desk)
    const targetHoverLift = !isOpen && hovered && p < 0.005 ? 0.012 : 0;
    hoverLiftRef.current += (targetHoverLift - hoverLiftRef.current) * Math.min(1, dt * 11);

    // Smoothly faded idle bob while open (zero step jump when closing starts)
    const bobWeight = smoothstepRange(0.86, 1.0, p);
    const idleBob = Math.sin(clock.getElapsedTime() * 1.5) * 0.0018 * bobWeight;

    if (rootRef.current) {
      rootRef.current.position.lerpVectors(math.closedPos, math.openPos, liftT);
      rootRef.current.position.y += hoverLiftRef.current + idleBob;
      rootRef.current.quaternion.slerpQuaternions(math.closedQuat, math.openQuat, liftT);
    }

    if (centerShiftRef.current) {
      centerShiftRef.current.position.x = THREE.MathUtils.lerp(-W * 0.5, 0, hingeT);
    }

    const flapAngle = THREE.MathUtils.lerp(Math.PI, 0.22, hingeT);
    if (leftFlapPivotRef.current) {
      leftFlapPivotRef.current.rotation.y = flapAngle;
    }

    if (closedSpineRef.current) {
      closedSpineRef.current.visible = hingeT < 0.2;
    }
    if (openSpineRef.current) {
      openSpineRef.current.visible = hingeT >= 0.15;
      openSpineRef.current.rotation.y = flapAngle * 0.5;
    }
  });

  const openExternal = (url: string) => {
    if (typeof window !== 'undefined' && url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const rightCenterX = 0.009 + (W - 0.016) * 0.5;
  const leftCenterX = -(0.0075 + (W - 0.0075) * 0.5);

  return (
    <group
      ref={rootRef}
      position={[-0.56, 1.494, 0.22]}
      rotation={[-Math.PI / 2, 0.28, 0]}
      onClick={(e) => {
        if (!isOpen) {
          e.stopPropagation();
          setHovered(false);
          onOpenWallet();
        }
      }}
      onPointerOver={(e) => {
        if (!isOpen && openAnim.current < 0.05) {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
          onHoverLabel('Leather Wallet: Open Identity Card');
        }
      }}
      onPointerOut={() => {
        setHovered(false);
        if (!isOpen) {
          document.body.style.cursor = 'auto';
          onHoverLabel(null);
        }
      }}
    >
      {/* Invisible raycast shield behind open wallet */}
      {isOpen && (
        <mesh
          position={[0, 0, -0.06]}
          onClick={(e) => e.stopPropagation()}
          onPointerOver={(e) => {
            e.stopPropagation();
            document.body.style.cursor = 'grab';
            onHoverLabel(null);
          }}
        >
          <planeGeometry args={[10, 10]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}

      <group ref={centerShiftRef} position={[-W * 0.5, 0, 0]}>
        {/* Realistic Concave (Cekung) Back Leather Spine Fold when Open */}
        <mesh
          ref={openSpineRef}
          visible={false}
          geometry={geos.concaveSpineGeo}
          position={[0, 0, 0]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial
            map={leather.map}
            bumpMap={leather.bumpMap}
            bumpScale={0.0035}
            roughnessMap={leather.roughnessMap}
            color="#351E12"
            roughness={0.7}
          />
        </mesh>

        {/* Supple Rounded C-Fold Leather Spine when Closed on Desk */}
        <mesh
          ref={closedSpineRef}
          geometry={geos.closedSpineGeo}
          position={[0, 0, 0]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial
            map={leather.map}
            bumpMap={leather.bumpMap}
            bumpScale={0.0035}
            roughnessMap={leather.roughnessMap}
            color="#382013"
            roughness={0.68}
          />
        </mesh>

        {/* ==================== RIGHT HALF: CLEAR PLASTIC ID WINDOW & IDENTITY CARD ==================== */}
        <group position={[0, 0, 0]}>
          <mesh geometry={geos.rightPanelGeo} position={[0, 0, -0.0082]} castShadow receiveShadow>
            <meshStandardMaterial
              map={leather.map}
              bumpMap={leather.bumpMap}
              bumpScale={0.004}
              roughnessMap={leather.roughnessMap}
              roughness={0.68}
            />
          </mesh>

          <mesh
            geometry={geos.rightFaceGeo}
            position={[0, 0, -0.0103]}
            rotation={[0, Math.PI, 0]}
            scale={[-1, 1, 1]}
          >
            <meshStandardMaterial
              map={backCoverTex}
              bumpMap={leather.bumpMap}
              bumpScale={0.003}
              roughness={0.64}
            />
          </mesh>

          <mesh geometry={geos.rightFaceGeo} position={[0, 0, 0.0003]}>
            <meshStandardMaterial
              map={rightIntTex}
              bumpMap={leather.bumpMap}
              bumpScale={0.002}
              roughness={0.74}
            />
          </mesh>

          <mesh position={[rightCenterX, H * 0.46, -0.0035]} rotation={[0, 0, -0.015]}>
            <boxGeometry args={[W * 0.8, 0.018, 0.0018]} />
            <meshStandardMaterial color="#DFD8C5" roughness={0.88} />
          </mesh>
          <mesh position={[rightCenterX + 0.003, H * 0.48, -0.0055]} rotation={[0, 0, 0.01]}>
            <boxGeometry args={[W * 0.78, 0.016, 0.0016]} />
            <meshStandardMaterial color="#CCD6C8" roughness={0.88} />
          </mesh>

          <mesh geometry={geos.idCardGeo} position={[rightCenterX, 0, 0.0016]}>
            <meshStandardMaterial
              map={idCardTex}
              roughness={0.44}
              metalness={0.02}
              polygonOffset
              polygonOffsetFactor={-1}
            />
          </mesh>

          {isOpen && (
            <>
              <mesh
                position={[rightCenterX + 0.029, -0.006, 0.0055]}
                onClick={(e) => {
                  e.stopPropagation();
                  openExternal(owner.spotifyUrl);
                }}
                onPointerOver={(e) => {
                  e.stopPropagation();
                  document.body.style.cursor = 'pointer';
                  onHoverLabel(`Open Spotify: ${owner.spotifyHandle}`);
                }}
                onPointerOut={() => {
                  document.body.style.cursor = 'auto';
                  onHoverLabel(null);
                }}
              >
                <planeGeometry args={[0.114, 0.015]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>
              <mesh
                position={[rightCenterX + 0.029, -0.022, 0.0055]}
                onClick={(e) => {
                  e.stopPropagation();
                  openExternal(owner.instagramUrl);
                }}
                onPointerOver={(e) => {
                  e.stopPropagation();
                  document.body.style.cursor = 'pointer';
                  onHoverLabel(`Open Instagram: ${owner.instagramHandle}`);
                }}
                onPointerOut={() => {
                  document.body.style.cursor = 'auto';
                  onHoverLabel(null);
                }}
              >
                <planeGeometry args={[0.114, 0.015]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>
            </>
          )}

          <mesh position={[rightCenterX, 0, 0.0026]}>
            <planeGeometry args={[0.18, 0.118]} />
            <meshPhysicalMaterial
              color="#FFFFFF"
              transparent
              opacity={0.09}
              roughness={0.1}
              metalness={0.02}
              clearcoat={0.7}
              clearcoatRoughness={0.12}
              depthWrite={false}
            />
          </mesh>
          <mesh position={[rightCenterX - 0.032, 0.008, 0.0029]} rotation={[0, 0, 0.56]}>
            <planeGeometry args={[0.014, 0.14]} />
            <meshBasicMaterial color="#FFFFFF" transparent opacity={0.045} depthWrite={false} />
          </mesh>

          <mesh geometry={geos.idWindowFrameGeo} position={[0, 0, 0.0014]} castShadow receiveShadow>
            <meshStandardMaterial
              map={leather.map}
              bumpMap={leather.bumpMap}
              bumpScale={0.003}
              color="#472B1C"
              roughness={0.66}
            />
          </mesh>
        </group>

        {/* ==================== LEFT HALF: HINGED LEATHER COVER + SCALLOPED CARD POCKETS ==================== */}
        <group ref={leftFlapPivotRef} position={[0, 0, 0.0045]}>
          <mesh geometry={geos.leftPanelGeo} position={[0, 0, -0.0127]} castShadow receiveShadow>
            <meshStandardMaterial
              map={leather.map}
              bumpMap={leather.bumpMap}
              bumpScale={0.004}
              roughnessMap={leather.roughnessMap}
              roughness={0.68}
            />
          </mesh>

          <mesh
            geometry={geos.leftFaceGeo}
            position={[0, 0, -0.0148]}
            rotation={[0, Math.PI, 0]}
            scale={[-1, 1, 1]}
          >
            <meshStandardMaterial
              map={frontCoverTex}
              bumpMap={leather.bumpMap}
              bumpScale={0.003}
              roughness={0.62}
            />
          </mesh>

          <mesh geometry={geos.leftFaceGeo} position={[0, 0, -0.0042]}>
            <meshStandardMaterial
              map={leftIntTex}
              bumpMap={leather.bumpMap}
              bumpScale={0.002}
              roughness={0.74}
            />
          </mesh>

          <mesh position={[leftCenterX, H * 0.46, -0.008]} rotation={[0, 0, 0.015]}>
            <boxGeometry args={[W * 0.78, 0.018, 0.0018]} />
            <meshStandardMaterial color="#DFD8C5" roughness={0.88} />
          </mesh>

          {/* Top Peeking Card */}
          <mesh geometry={geos.cardGeo} position={[leftCenterX, 0.044, -0.0036]}>
            <meshStandardMaterial color="#1F222A" roughness={0.42} metalness={0.22} />
          </mesh>
          <mesh position={[leftCenterX - 0.054, 0.053, -0.0022]}>
            <boxGeometry args={[0.022, 0.015, 0.0005]} />
            <meshStandardMaterial color="#D4AA63" roughness={0.28} metalness={0.82} />
          </mesh>

          {/* Scalloped Leather Card Pocket Tier 1 */}
          <mesh geometry={geos.pocketGeo} position={[leftCenterX, 0.016, -0.0022]} castShadow>
            <meshStandardMaterial
              map={leather.map}
              bumpMap={leather.bumpMap}
              bumpScale={0.003}
              color="#4B2E1E"
              roughness={0.66}
            />
          </mesh>

          {/* Middle Peeking Card (Retains original Burgundy stripe inside wallet) */}
          <mesh geometry={geos.cardGeo} position={[leftCenterX, 0.002, -0.0004]}>
            <meshStandardMaterial color="#EAE0CE" roughness={0.46} />
          </mesh>
          <mesh position={[leftCenterX, 0.012, 0.001]}>
            <boxGeometry args={[0.158, 0.0055, 0.0004]} />
            <meshStandardMaterial color="#842536" roughness={0.44} />
          </mesh>

          {/* Scalloped Leather Card Pocket Tier 2 */}
          <mesh geometry={geos.pocketGeo} position={[leftCenterX, -0.022, 0.001]} castShadow>
            <meshStandardMaterial
              map={leather.map}
              bumpMap={leather.bumpMap}
              bumpScale={0.003}
              color="#402618"
              roughness={0.68}
            />
          </mesh>

          {/* Scalloped Leather Card Pocket Tier 3 + Subtle Brass Corner Pin */}
          <mesh
            geometry={geos.bottomPocketGeo}
            position={[leftCenterX, -0.056, 0.0034]}
            castShadow
          >
            <meshStandardMaterial
              map={leather.map}
              bumpMap={leather.bumpMap}
              bumpScale={0.003}
              color="#4C2E1E"
              roughness={0.65}
            />
          </mesh>
          <mesh position={[-W + 0.028, -0.06, 0.006]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.0038, 0.0038, 0.0014, 12]} />
            <meshStandardMaterial color="#C89B54" roughness={0.28} metalness={0.86} />
          </mesh>
        </group>
      </group>
    </group>
  );
}