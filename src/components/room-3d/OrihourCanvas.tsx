'use client';

import React, { ComponentRef, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { AtmosphereState } from '@/lib/timeAtmosphere';
import {
  CameraFocusTarget,
  GuestbookPostcard,
  RoomConfig,
  VinylRecord,
  WeatherType,
} from '@/types/orihour';
import WindowWorld from './WindowWorld';
import RoomDeskProps from './RoomDeskProps';
import DeskClock3D from './DeskClock3D';
import DeskNotepad3D from './DeskNotepad3D';
import DeskWallet3D from './DeskWallet3D';
import Turntable3D from './Turntable3D';
import VinylCrate3D from './VinylCrate3D';
import Pinboard3D from './Pinboard3D';

interface OrihourCanvasProps {
  config: RoomConfig;
  vinyls: VinylRecord[];
  activeVinyl: VinylRecord | null;
  previousVinyl: VinylRecord | null;
  postcards: GuestbookPostcard[];
  isPlaying: boolean;
  isTransferring: boolean;
  rackReadyToShift: boolean;
  walletOpen: boolean;
  transferOrigin: THREE.Vector3;
  cameraFocus: CameraFocusTarget;
  isEntryMode?: boolean;
  hourDecimal: number;
  isLiveTime: boolean;
  weather: WeatherType;
  lampOn: boolean;
  atmosphere: AtmosphereState;
  onSceneReady?: () => void;
  onSelectVinyl: (vinyl: VinylRecord, origin: THREE.Vector3) => void;
  onRackCleared: () => void;
  onTransferComplete: () => void;
  onTogglePlay: () => void;
  onToggleLamp: () => void;
  onCycleWeather: () => void;
  onClickClock: () => void;
  onFocusNotepad: () => void;
  onOpenLinerNotes: () => void;
  onClickPinboard: () => void;
  onOpenWallet: () => void;
  onHoverLabel: (label: string | null) => void;
}

const CAMERA_RIG: Record<
  CameraFocusTarget,
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  ENTRY: { pos: [2.95, 2.68, 4.45], target: [-0.38, 1.92, -0.35] },
  ROOM: { pos: [0.0, 2.25, 3.85], target: [0.0, 2.08, 1.85] },
  DESK: { pos: [0.0, 2.34, 2.82], target: [0.0, 2.22, 1.15] },
  TURNTABLE: { pos: [0.06, 2.36, 1.5], target: [0.06, 1.66, -0.28] },
  CRATE: { pos: [-0.42, 2.66, 0.9], target: [-1.08, 1.76, -0.3] },
  CLOCK: { pos: [-1.52, 1.78, 0.88], target: [-1.82, 1.59, 0.18] },
  WINDOW: { pos: [-0.15, 2.48, 0.95], target: [-0.15, 2.48, -2.5] },
  NOTES: { pos: [1.14, 2.26, 0.32], target: [1.18, 1.49, 0.08] },
  PINBOARD: { pos: [1.45, 2.34, 0.95], target: [3.62, 2.34, 0.95] },
  WALLET: { pos: [-0.52, 2.04, 0.96], target: [-0.52, 1.97, 0.38] },
};

// Durasi dan kurva easing disamakan dengan animasi pembukaan dompet (0.92s easeInOutCubic)
const CAMERA_TRANSITION_DURATION = 0.92;

function easeInOutCubic(x: number): number {
  const c = Math.max(0, Math.min(1, x));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

const NOOP = () => {};

/**
 * Compiles shaders behind the curtain and waits for 3 consecutive smooth frames
 * (or 14 frames max) so the opening reveal never stutters.
 */
function SceneReadyNotifier({ onReady }: { onReady?: () => void }) {
  const { gl, scene, camera } = useThree();
  const totalFrames = useRef(0);
  const smoothStreak = useRef(0);
  const compiled = useRef(false);
  const notified = useRef(false);

  useFrame((_, delta) => {
    if (notified.current) return;

    if (!compiled.current) {
      compiled.current = true;
      try {
        gl.compile(scene, camera);
      } catch {
        // Ignore compile errors on fallback contexts
      }
      return;
    }

    totalFrames.current += 1;
    if (delta < 0.045) {
      smoothStreak.current += 1;
    } else {
      smoothStreak.current = 0;
    }

    if (smoothStreak.current >= 3 || totalFrames.current >= 14) {
      notified.current = true;
      onReady?.();
    }
  });

  return null;
}

function CameraOrbitRig({
  focus,
  isEntryMode,
}: {
  focus: CameraFocusTarget;
  isEntryMode: boolean;
}) {
  const { camera } = useThree();
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null);
  const isTransitioning = useRef(false);
  const transitionProgress = useRef(1);
  const elapsedRef = useRef(0);

  const startPos = useRef(new THREE.Vector3(...CAMERA_RIG.ENTRY.pos));
  const startTarget = useRef(new THREE.Vector3(...CAMERA_RIG.ENTRY.target));
  const goalPos = useRef(new THREE.Vector3(...CAMERA_RIG.ENTRY.pos));
  const goalTarget = useRef(new THREE.Vector3(...CAMERA_RIG.ENTRY.target));
  const desiredPos = useMemo(() => new THREE.Vector3(), []);
  const desiredTarget = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const rig = CAMERA_RIG[focus] || CAMERA_RIG.DESK;
    startPos.current.copy(camera.position);
    if (controlsRef.current) {
      startTarget.current.copy(controlsRef.current.target);
    } else {
      startTarget.current.copy(goalTarget.current);
    }
    goalPos.current.set(...rig.pos);
    goalTarget.current.set(...rig.target);
    transitionProgress.current = 0;
    isTransitioning.current = !isEntryMode;
  }, [focus, isEntryMode, camera]);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    const dt = Math.min(delta, 0.045);

    if (isEntryMode) {
      elapsedRef.current += dt;
      const t = elapsedRef.current;
      const entryRig = CAMERA_RIG.ENTRY;
      desiredPos.set(
        entryRig.pos[0] + Math.sin(t * 0.2) * 0.14,
        entryRig.pos[1] + Math.cos(t * 0.16) * 0.04,
        entryRig.pos[2] + Math.cos(t * 0.18) * 0.1
      );
      desiredTarget.set(
        entryRig.target[0] + Math.sin(t * 0.14) * 0.06,
        entryRig.target[1],
        entryRig.target[2]
      );
      const alpha = 1 - Math.exp(-2.8 * dt);
      camera.position.lerp(desiredPos, alpha);
      controls.target.lerp(desiredTarget, alpha);
      controls.update();
      return;
    }

    if (isTransitioning.current) {
      transitionProgress.current = Math.min(
        1,
        transitionProgress.current + dt / CAMERA_TRANSITION_DURATION
      );
      const eased = easeInOutCubic(transitionProgress.current);
      camera.position.lerpVectors(startPos.current, goalPos.current, eased);
      controls.target.lerpVectors(startTarget.current, goalTarget.current, eased);

      if (transitionProgress.current >= 1) {
        isTransitioning.current = false;
      }
    }

    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -3.35, 3.35);
    camera.position.y = THREE.MathUtils.clamp(camera.position.y, 0.55, 4.25);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -1.0, 4.95);

    controls.target.x = THREE.MathUtils.clamp(controls.target.x, -3.55, 3.65);
    controls.target.y = THREE.MathUtils.clamp(controls.target.y, 0.7, 3.7);
    controls.target.z = THREE.MathUtils.clamp(controls.target.z, -1.1, 4.4);

    controls.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enabled={!isEntryMode}
      enableDamping
      dampingFactor={0.07}
      enableZoom
      zoomSpeed={0.95}
      enableRotate
      rotateSpeed={0.85}
      enablePan
      panSpeed={0.65}
      minDistance={0.42}
      maxDistance={4.8}
      minAzimuthAngle={-Infinity}
      maxAzimuthAngle={Infinity}
      minPolarAngle={0.22}
      maxPolarAngle={Math.PI * 0.65}
      onStart={() => {
        isTransitioning.current = false;
      }}
    />
  );
}

function SceneContents(props: OrihourCanvasProps) {
  const { atmosphere, lampOn, walletOpen, weather } = props;

  const returnSlotTargetRef = useRef(new THREE.Vector3(-1.04, 1.815, -0.36));
  const bgHover = walletOpen ? NOOP : props.onHoverLabel;

  const lampTarget = useMemo(() => {
    const obj = new THREE.Object3D();
    obj.position.set(1.16, 1.48, -0.02);
    return obj;
  }, []);

  const sunTarget = useMemo(() => {
    const obj = new THREE.Object3D();
    obj.position.set(0.0, 2.0, 1.8);
    return obj;
  }, []);

  // VSM Gaussian blur radius softly diffuses diagonal sunlight edges with zero stair-stepping
  const sunShadowRadius = weather === 'CLOUDY' ? 5.2 : weather === 'RAIN' ? 5.8 : 3.6;

  return (
    <>
      <color attach="background" args={[atmosphere.fogColor]} />
      <fogExp2 attach="fog" args={[atmosphere.fogColor, 0.009]} />

      <SceneReadyNotifier onReady={props.onSceneReady} />
      <CameraOrbitRig focus={props.cameraFocus} isEntryMode={Boolean(props.isEntryMode)} />

      {/* Balanced Warm Interior IBL */}
      <Environment resolution={128} environmentIntensity={atmosphere.envIntensity * 0.72}>
        <Lightformer
          form="rect"
          intensity={0.75}
          color="#F5EFE6"
          position={[0, 2.5, -5]}
          scale={[6, 3.5, 1]}
        />
        <Lightformer
          form="rect"
          intensity={0.7}
          color="#F3ECE2"
          position={[0, 2.5, 6]}
          rotation={[0, Math.PI, 0]}
          scale={[6, 3.5, 1]}
        />
        <Lightformer
          form="rect"
          intensity={0.65}
          color="#F3ECE2"
          position={[-5, 2.5, 1.5]}
          rotation={[0, Math.PI / 2, 0]}
          scale={[6, 3.5, 1]}
        />
        <Lightformer
          form="rect"
          intensity={0.65}
          color="#F3ECE2"
          position={[5, 2.5, 1.5]}
          rotation={[0, -Math.PI / 2, 0]}
          scale={[6, 3.5, 1]}
        />
        <Lightformer
          form="circle"
          intensity={lampOn ? 2.6 : 0.3}
          color="#FFC87A"
          position={[2.1, 2.3, 0.0]}
          scale={1.8}
        />
        <Lightformer
          form="rect"
          intensity={0.8}
          color="#F7F0E4"
          position={[0, 4.4, 2.0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[5, 5, 1]}
        />
      </Environment>

      <hemisphereLight
        args={[atmosphere.roomFillColor, atmosphere.hemiGround, atmosphere.hemiIntensity * 0.92]}
      />

      <pointLight
        position={[0.0, 4.1, 1.8]}
        color={atmosphere.roomFillColor}
        intensity={atmosphere.roomFillIntensity * 11}
        distance={14}
        decay={1.45}
      />

      <pointLight
        position={[-0.78, 2.26, 0.92]}
        color="#FFF5E6"
        intensity={walletOpen ? 0.52 : 0}
        distance={2.6}
        decay={2}
      />

      {/* Full-Room VSM Sunlight Shadow */}
      <primitive object={sunTarget} />
      <directionalLight
        position={atmosphere.sunLightPosition}
        target={sunTarget}
        color={atmosphere.sunColor}
        intensity={atmosphere.sunIntensity * 0.68}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-radius={sunShadowRadius}
        shadow-blurSamples={12}
        shadow-camera-left={-7.2}
        shadow-camera-right={7.2}
        shadow-camera-top={6.2}
        shadow-camera-bottom={-4.2}
        shadow-camera-near={1}
        shadow-camera-far={32}
        shadow-bias={-0.00015}
        shadow-normalBias={0.015}
      />

      {/* Desk Lamp Spotlight */}
      <primitive object={lampTarget} />
      <spotLight
        position={[1.68, 2.01, -0.28]}
        target={lampTarget}
        color="#FFB85C"
        intensity={lampOn ? 7.2 : 0}
        distance={7.5}
        angle={Math.PI * 0.42}
        penumbra={0.72}
        castShadow
        shadow-mapSize={[512, 512]}
        shadow-radius={2.8}
        shadow-blurSamples={8}
        shadow-bias={-0.0002}
        shadow-normalBias={0.015}
      />
      <pointLight
        position={[1.67, 1.98, -0.27]}
        color="#FFAE42"
        intensity={lampOn ? 1.25 : 0}
        distance={4.0}
      />

      {/* Baked ContactShadows (frames={1} keeps FPS smooth) */}
      <ContactShadows
        frames={1}
        position={[0.05, 1.483, -0.39]}
        opacity={0.48}
        scale={5.4}
        blur={1.8}
        far={1.4}
        resolution={256}
        color="#1A110B"
      />

      <WindowWorld
        atmosphere={atmosphere}
        weather={props.weather}
        hourDecimal={props.hourDecimal}
      />

      <RoomDeskProps
        config={props.config}
        wallTint={atmosphere.wallTint}
        weather={props.weather}
        lampOn={lampOn}
        interactionLocked={walletOpen}
        onToggleLamp={walletOpen ? NOOP : props.onToggleLamp}
        onCycleWeather={walletOpen ? NOOP : props.onCycleWeather}
        onHoverLabel={bgHover}
      />

      <Pinboard3D
        postcards={props.postcards}
        onClickPinboard={walletOpen ? NOOP : props.onClickPinboard}
        onHoverLabel={bgHover}
      />

      <DeskClock3D
        hourDecimal={props.hourDecimal}
        isLiveTime={props.isLiveTime}
        phaseLabel={atmosphere.phaseLabel}
        onClickClock={walletOpen ? NOOP : props.onClickClock}
        onHoverLabel={bgHover}
      />

      <DeskNotepad3D
        activeVinyl={props.activeVinyl}
        isPlaying={props.isPlaying}
        onFocusNotepad={walletOpen ? NOOP : props.onFocusNotepad}
        onHoverLabel={bgHover}
      />

      <DeskWallet3D
        owner={props.config.ownerProfile}
        isOpen={walletOpen}
        onOpenWallet={props.onOpenWallet}
        onHoverLabel={props.onHoverLabel}
      />

      <Turntable3D
        activeVinyl={props.activeVinyl}
        previousVinyl={props.previousVinyl}
        isPlaying={props.isPlaying}
        isTransferring={props.isTransferring}
        transferOrigin={props.transferOrigin}
        returnSlotTargetRef={returnSlotTargetRef}
        onRackCleared={props.onRackCleared}
        onTransferComplete={props.onTransferComplete}
        onTogglePlay={walletOpen ? NOOP : props.onTogglePlay}
        onOpenLinerNotes={walletOpen ? NOOP : props.onOpenLinerNotes}
        onHoverLabel={bgHover}
      />

      <VinylCrate3D
        vinyls={props.vinyls}
        activeVinylId={props.activeVinyl?.id ?? null}
        isTransferring={props.isTransferring || walletOpen}
        canShiftRack={props.rackReadyToShift}
        returningVinylId={props.isTransferring ? props.previousVinyl?.id ?? null : null}
        returnSlotTargetRef={returnSlotTargetRef}
        onSelectVinyl={walletOpen ? NOOP : props.onSelectVinyl}
        onHoverLabel={bgHover}
      />
    </>
  );
}

export default function OrihourCanvas(props: OrihourCanvasProps) {
  return (
    <Canvas
      shadows="variance"
      dpr={[1, 1.35]}
      camera={{ position: CAMERA_RIG.ENTRY.pos, fov: 46, near: 0.1, far: 120 }}
      gl={{
        antialias: true,
        powerPreference: 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.02,
      }}
      className="fixed inset-0 h-screen w-screen bg-[#120E0B]"
    >
      <SceneContents {...props} />
    </Canvas>
  );
}