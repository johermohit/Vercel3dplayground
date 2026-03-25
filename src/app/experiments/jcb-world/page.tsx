"use client";

import React, { useRef, Suspense, useState, useEffect, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, OrbitControls, Sky } from "@react-three/drei";
import { Physics, RigidBody, CuboidCollider } from "@react-three/rapier";
import { useConnectionStore } from "@/store/connectionStore";
import { usePeerHost } from "@/hooks/usePeerHost";
import BackToLobby from "@/components/BackToLobby";
import QROverlay from "@/components/QROverlay";
import * as THREE from "three";
import { WorldPlacement, getAssetById, DEFAULT_WORLD_LAYOUT } from "@/world/assetCatalog";

interface VehicleControls {
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    lift: number;
    bucket: number;
}

// Shared ref for vehicle position (so camera can follow)
const vehicleState = { x: 0, z: 0, rotation: 0 };

// Follow camera component
function FollowCamera() {
    const cameraOffset = new THREE.Vector3(0, 25, 50);
    const targetOffset = new THREE.Vector3(0, 8, 0);

    useFrame(({ camera }) => {
        // Calculate camera position behind vehicle
        const angle = vehicleState.rotation;
        const offsetX = Math.sin(angle) * cameraOffset.z + Math.cos(angle) * cameraOffset.x;
        const offsetZ = Math.cos(angle) * cameraOffset.z - Math.sin(angle) * cameraOffset.x;

        // Smoothly lerp camera position
        camera.position.lerp(
            new THREE.Vector3(
                vehicleState.x - offsetX,
                cameraOffset.y,
                vehicleState.z - offsetZ
            ),
            0.05
        );

        // Look at vehicle
        camera.lookAt(
            vehicleState.x + targetOffset.x,
            targetOffset.y,
            vehicleState.z + targetOffset.z
        );
    });

    return null;
}

// JCB Loader with driving physics - BIGGER!
function JCBLoader({ controls }: { controls: VehicleControls }) {
    const groupRef = useRef<THREE.Group>(null);
    const { scene } = useGLTF("/assets/jcb_435b_loader.glb");
    const clonedScene = useMemo(() => scene.clone(), [scene]);

    const positionRef = useRef({ x: 0, z: 0, rotation: 0 });
    const velocityRef = useRef(0);

    // Get nodes for arm/bucket control
    const nodes = useMemo(() => {
        const armNode = clonedScene.getObjectByName("Arm") || clonedScene.getObjectByName("arm");
        const bucketNode = clonedScene.getObjectByName("Bucket") || clonedScene.getObjectByName("bucket");
        return { arm: armNode, bucket: bucketNode };
    }, [clonedScene]);

    useFrame((_, delta) => {
        if (!groupRef.current) return;

        // Driving physics
        const acceleration = controls.forward ? 25 : controls.backward ? -18 : 0;
        const turnRate = (controls.left ? 1 : 0) - (controls.right ? 1 : 0);

        // Apply acceleration
        velocityRef.current += acceleration * delta;

        // Friction/drag
        velocityRef.current *= 0.95;

        // Clamp velocity
        velocityRef.current = THREE.MathUtils.clamp(velocityRef.current, -15, 20);

        // Turn only when moving
        if (Math.abs(velocityRef.current) > 0.5) {
            positionRef.current.rotation += turnRate * delta * 2 * Math.sign(velocityRef.current);
        }

        // Update position
        positionRef.current.x += Math.sin(positionRef.current.rotation) * velocityRef.current * delta;
        positionRef.current.z += Math.cos(positionRef.current.rotation) * velocityRef.current * delta;

        // Apply to group
        groupRef.current.position.x = positionRef.current.x;
        groupRef.current.position.z = positionRef.current.z;
        groupRef.current.rotation.y = positionRef.current.rotation;

        // Update shared state for camera
        vehicleState.x = positionRef.current.x;
        vehicleState.z = positionRef.current.z;
        vehicleState.rotation = positionRef.current.rotation;

        // Arm/bucket control from slider values
        if (nodes.arm) {
            nodes.arm.rotation.x = (controls.lift - 0.5) * 0.6;
        }
        if (nodes.bucket) {
            nodes.bucket.rotation.x = (controls.bucket - 0.5) * 0.8;
        }
    });

    return (
        <group ref={groupRef} position-y={6}>
            <primitive object={clonedScene} scale={50} />
        </group>
    );
}

// Single world asset with optional physics
function WorldAssetInstance({
    assetId,
    position,
    rotation = [0, 0, 0],
    scale: overrideScale,
    randomScaleVariance = 0,
}: WorldPlacement & { randomScaleVariance?: number }) {
    const asset = getAssetById(assetId);

    // Random scale variance (memoized so it doesn't change)
    const scaleMultiplier = useMemo(() => {
        if (randomScaleVariance <= 0) return 1;
        return 1 + (Math.random() - 0.5) * randomScaleVariance * 2;
    }, [randomScaleVariance]);

    if (!asset) {
        console.warn(`Asset not found: ${assetId}`);
        return null;
    }

    const { scene } = useGLTF(asset.path);
    const clonedScene = useMemo(() => scene.clone(), [scene]);

    const finalScale = (overrideScale ?? asset.scale ?? 1) * scaleMultiplier;
    const yOffset = asset.groundLevel ?? 0;

    // Add physics collider for collidable assets
    if (asset.collidable) {
        return (
            <RigidBody type="fixed" position={[position[0], position[1] + yOffset, position[2]]}>
                <primitive
                    object={clonedScene}
                    rotation={rotation}
                    scale={finalScale}
                />
            </RigidBody>
        );
    }

    return (
        <primitive
            object={clonedScene}
            position={[position[0], position[1] + yOffset, position[2]]}
            rotation={rotation}
            scale={finalScale}
        />
    );
}

// Trees with random size variance
function ScatteredTrees({ count = 20, areaSize = 120 }: { count?: number; areaSize?: number }) {
    const trees = useMemo(() => {
        const result = [];
        for (let i = 0; i < count; i++) {
            const isLarge = Math.random() > 0.4;
            result.push({
                assetId: isLarge ? 'tree-large' : 'tree-small',
                position: [
                    (Math.random() - 0.5) * areaSize,
                    0,
                    (Math.random() - 0.5) * areaSize,
                ] as [number, number, number],
                rotation: [0, Math.random() * Math.PI * 2, 0] as [number, number, number],
                randomScaleVariance: 0.4, // 40% size variance
            });
        }
        return result;
    }, [count, areaSize]);

    return (
        <>
            {trees.map((tree, i) => (
                <WorldAssetInstance key={`tree-${i}`} {...tree} />
            ))}
        </>
    );
}

// World loader with physics
function WorldAssets({ layout }: { layout: WorldPlacement[] }) {
    return (
        <>
            {layout.map((placement, index) => (
                <WorldAssetInstance key={`${placement.assetId}-${index}`} {...placement} />
            ))}
        </>
    );
}

// Desktop keyboard controls
function useKeyboardControls() {
    const [keys, setKeys] = useState({
        forward: false,
        backward: false,
        left: false,
        right: false,
    });

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            switch (e.key.toLowerCase()) {
                case 'w': case 'arrowup': setKeys(k => ({ ...k, forward: true })); break;
                case 's': case 'arrowdown': setKeys(k => ({ ...k, backward: true })); break;
                case 'a': case 'arrowleft': setKeys(k => ({ ...k, left: true })); break;
                case 'd': case 'arrowright': setKeys(k => ({ ...k, right: true })); break;
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            switch (e.key.toLowerCase()) {
                case 'w': case 'arrowup': setKeys(k => ({ ...k, forward: false })); break;
                case 's': case 'arrowdown': setKeys(k => ({ ...k, backward: false })); break;
                case 'a': case 'arrowleft': setKeys(k => ({ ...k, left: false })); break;
                case 'd': case 'arrowright': setKeys(k => ({ ...k, right: false })); break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    return keys;
}

// Control panel for desktop
function ControlPanel({ lift, bucket, setLift, setBucket }: {
    lift: number;
    bucket: number;
    setLift: (v: number) => void;
    setBucket: (v: number) => void;
}) {
    return (
        <div className="absolute bottom-6 left-6 bg-zinc-900/90 backdrop-blur p-4 rounded-xl border border-yellow-500/30 w-64">
            <h3 className="text-yellow-400 font-bold mb-3">🚜 JCB CONTROLS</h3>
            <p className="text-xs text-gray-500 mb-3">WASD or Arrow Keys to drive</p>

            <div className="space-y-3">
                <div>
                    <label className="text-xs text-gray-400 flex justify-between">
                        <span>⬆️ ARM LIFT</span>
                        <span>{Math.round(lift * 100)}%</span>
                    </label>
                    <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={lift}
                        onChange={(e) => setLift(parseFloat(e.target.value))}
                        className="w-full h-2 bg-zinc-800 rounded appearance-none cursor-pointer accent-yellow-500"
                    />
                </div>

                <div>
                    <label className="text-xs text-gray-400 flex justify-between">
                        <span>🪣 BUCKET</span>
                        <span>{Math.round(bucket * 100)}%</span>
                    </label>
                    <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={bucket}
                        onChange={(e) => setBucket(parseFloat(e.target.value))}
                        className="w-full h-2 bg-zinc-800 rounded appearance-none cursor-pointer accent-yellow-500"
                    />
                </div>
            </div>
        </div>
    );
}

// Ground - simple flat with grid texture look
function Ground() {
    return (
        <RigidBody type="fixed" friction={1}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
                <planeGeometry args={[400, 400]} />
                <meshStandardMaterial color="#3d6b47" />
            </mesh>
            <CuboidCollider args={[200, 0.1, 200]} position={[0, -0.1, 0]} />
        </RigidBody>
    );
}

// Preload
useGLTF.preload("/assets/jcb_435b_loader.glb");

export default function JCBWorldPage() {
    usePeerHost();
    const { isConnected, sensorData } = useConnectionStore();

    const keyboardControls = useKeyboardControls();
    const [lift, setLift] = useState(0.5);
    const [bucket, setBucket] = useState(0.5);

    // Merge keyboard + phone controls
    const controls = useMemo((): VehicleControls => {
        // Phone excavator controls (D-pad style)
        const phoneData = sensorData.excavator;

        return {
            forward: keyboardControls.forward || phoneData?.forward || false,
            backward: keyboardControls.backward || phoneData?.backward || false,
            left: keyboardControls.left || phoneData?.left || false,
            right: keyboardControls.right || phoneData?.right || false,
            lift: phoneData?.armUp ? 1 : phoneData?.armDown ? 0 : lift,
            bucket: phoneData?.bucketUp ? 1 : phoneData?.bucketDown ? 0 : bucket,
        };
    }, [keyboardControls, sensorData, lift, bucket]);

    return (
        <div className="h-screen w-full bg-zinc-950 overflow-hidden">
            <BackToLobby />

            {/* Header */}
            <div className="absolute top-4 left-16 z-10">
                <div className="flex items-center gap-3">
                    <span className="text-3xl">🏗️</span>
                    <div>
                        <h1 className="text-xl font-bold text-yellow-400">JCB WORLD</h1>
                        <p className="text-[10px] text-zinc-500">DRIVE • EXPLORE • BUILD</p>
                    </div>
                </div>
            </div>

            {/* Connection Status */}
            <div className="absolute top-4 right-4 z-10">
                <div className={`px-3 py-1 rounded-full text-xs flex items-center gap-2 ${isConnected ? "bg-green-500/20 text-green-400" : "bg-zinc-800 text-zinc-500"
                    }`}>
                    <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-zinc-600"}`} />
                    {isConnected ? "📱 PHONE CONNECTED" : "⌨️ KEYBOARD MODE"}
                </div>
            </div>

            {/* 3D Canvas */}
            <Canvas shadows camera={{ position: [50, 35, 50], fov: 60 }}>
                <ambientLight intensity={0.5} />
                <directionalLight
                    position={[80, 80, 40]}
                    intensity={1.8}
                    castShadow
                    shadow-mapSize={[2048, 2048]}
                    shadow-camera-far={200}
                    shadow-camera-left={-100}
                    shadow-camera-right={100}
                    shadow-camera-top={100}
                    shadow-camera-bottom={-100}
                />

                <Physics gravity={[0, -30, 0]}>
                    <Suspense fallback={null}>
                        {/* JCB Loader */}
                        <JCBLoader controls={controls} />

                        {/* World assets with physics */}
                        <WorldAssets layout={DEFAULT_WORLD_LAYOUT} />

                        {/* Scattered trees with variance */}
                        <ScatteredTrees count={25} areaSize={150} />
                    </Suspense>

                    {/* Ground with physics */}
                    <Ground />
                </Physics>

                {/* Follow camera */}
                <FollowCamera />

                {/* Sky */}
                <Sky sunPosition={[100, 30, 100]} />

                <gridHelper args={[400, 100, "#2a4a32", "#1a3a22"]} position={[0, 0.05, 0]} />
            </Canvas>

            {/* Desktop Controls */}
            <ControlPanel lift={lift} bucket={bucket} setLift={setLift} setBucket={setBucket} />

            {/* QR Code for Phone - uses excavator mode (D-pad) */}
            <QROverlay mode="excavator" />

            {/* Instructions */}
            <div className="absolute bottom-6 right-6 bg-zinc-900/80 backdrop-blur p-3 rounded-lg text-xs text-gray-400 max-w-48">
                <p className="font-bold text-white mb-1">📱 Phone Controls</p>
                <p>Scan QR → D-pad to drive</p>
                <p className="mt-2 font-bold text-white">⌨️ Keyboard</p>
                <p>WASD or Arrow Keys</p>
            </div>
        </div>
    );
}
