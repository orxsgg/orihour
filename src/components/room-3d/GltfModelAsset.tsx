'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

interface GltfModelAssetProps {
  url: string;
  targetSize: [number, number, number];
  rotation?: [number, number, number];
  offset?: [number, number, number];
  fallback: React.ReactNode;
}

const modelExistsCache = new Map<string, Promise<boolean>>();

function checkGlbAvailable(url: string): Promise<boolean> {
  if (!modelExistsCache.has(url)) {
    const req = fetch(url, { method: 'HEAD' })
      .then((res) => res.ok)
      .catch(() => false);
    modelExistsCache.set(url, req);
  }
  return modelExistsCache.get(url)!;
}

function NormalizedGltfMesh({
  url,
  targetSize,
  rotation = [0, 0, 0],
  offset = [0, 0, 0],
}: Omit<GltfModelAssetProps, 'fallback'>) {
  const { scene } = useGLTF(url);

  const normalizedGroup = useMemo(() => {
    const cloned = scene.clone(true);
    cloned.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const scaleX = targetSize[0] / Math.max(size.x, 0.0001);
    const scaleY = targetSize[1] / Math.max(size.y, 0.0001);
    const scaleZ = targetSize[2] / Math.max(size.z, 0.0001);
    const uniformScale = Math.min(scaleX, scaleY, scaleZ);

    cloned.scale.setScalar(uniformScale);
    cloned.position.set(
      -center.x * uniformScale,
      -box.min.y * uniformScale,
      -center.z * uniformScale
    );

    cloned.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) {
        const mesh = node as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });

    const pivot = new THREE.Group();
    pivot.add(cloned);
    return pivot;
  }, [scene, targetSize]);

  return (
    <group position={offset} rotation={rotation}>
      <primitive object={normalizedGroup} />
    </group>
  );
}

export default function GltfModelAsset({
  url,
  targetSize,
  rotation,
  offset,
  fallback,
}: GltfModelAssetProps) {
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    checkGlbAvailable(url).then((exists) => {
      if (active) setAvailable(exists);
    });
    return () => {
      active = false;
    };
  }, [url]);

  if (!available) {
    return <>{fallback}</>;
  }

  return (
    <Suspense fallback={fallback}>
      <NormalizedGltfMesh
        url={url}
        targetSize={targetSize}
        rotation={rotation}
        offset={offset}
      />
    </Suspense>
  );
}