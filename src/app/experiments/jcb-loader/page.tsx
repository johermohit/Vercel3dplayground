"use client";

import React, { useRef, Suspense, useState, useEffect, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations, OrbitControls, Environment } from "@react-three/drei";
import { useConnectionStore } from "@/store/connectionStore";
import { usePeerHost } from "@/hooks/usePeerHost";
import BackToLobby from "@/components/BackToLobby";
import QROverlay from "@/components/QROverlay";
import * as THREE from "three";

interface LoaderControls {
    lift: number;      // 0 to 1
    bucket: number;    // 0 to 1
    steering: number;  // -1 to 1
    throttle: number;  // -1 to 1
}

// JCB Loader Component with Animation Support
function JCBLoader({ controls }: { controls: LoaderControls }) {
    const groupRef = useRef<THREE.Group>(null);
    const { scene, animations } = useGLTF("/assets/jcb_435b_loader.glb");
    const clonedScene = useMemo(() => scene.clone(), [scene]);
    const { actions, mixer } = useAnimations(animations, groupRef);

    // Track position and rotation for movement
    const positionRef = useRef({ x: 0, z: 0, rotation: 0 });

    // Log available animations
    useEffect(() => {
        console.log("Available animations:", Object.keys(actions));
        console.log("Animation clips:", animations.map(a => a.name));
    }, [actions, animations]);

    // Get tire nodes for rotation
    const tireFLNode = useMemo(() => clonedScene.getObjectByName("Tire_FL"), [clonedScene]);
    const tireFRNode = useMemo(() => clonedScene.getObjectByName("Tire_FR"), [clonedScene]);
    const tireRRNode = useMemo(() => clonedScene.getObjectByName("Tire_RR"), [clonedScene]);
    const tireRR1Node = useMemo(() => clonedScene.getObjectByName("Tire_RR_1"), [clonedScene]);

    // Get steering assembly (front axle with tires)
    const steeringAssembly = useMemo(() => clonedScene.getObjectByName("Steering"), [clonedScene]);

    // Get main lift for arm
    const mainLift = useMemo(() => clonedScene.getObjectByName("Main_lift"), [clonedScene]);
    const bucket = useMemo(() => clonedScene.getObjectByName("Bucket"), [clonedScene]);

    // Apply controls each frame
    useFrame((_, delta) => {
        if (!groupRef.current) return;

        // Try animation mixer approach
        if (mixer && animations.length > 0) {
            animations.forEach((clip) => {
                const action = actions[clip.name];
                if (action) {
                    action.play();
                    action.paused = true;
                    if (clip.name.toLowerCase().includes("lift")) {
                        action.time = controls.lift * clip.duration;
                    } else if (clip.name.toLowerCase().includes("bucket")) {
                        action.time = controls.bucket * clip.duration;
                    }
                }
            });
        }

        // Direct node manipulation for arm/bucket
        if (mainLift) {
            mainLift.rotation.x = -controls.lift * 0.5;
        }
        if (bucket) {
            bucket.rotation.x = controls.bucket * 0.8 - 0.4;
        }

        // Steer front wheels
        if (steeringAssembly) {
            steeringAssembly.rotation.y = controls.steering * 0.3;
        }

        // Rotate tires based on throttle
        const tireRotation = controls.throttle * delta * 8;
        [tireFLNode, tireFRNode, tireRRNode, tireRR1Node].forEach(tire => {
            if (tire) {
                tire.rotation.x += tireRotation;
            }
        });

        // MOVE THE WHOLE VEHICLE based on throttle and steering
        const speed = controls.throttle * delta * 200; // Movement speed
        const turnRate = controls.steering * delta * 1.5; // Turn rate

        // Update rotation (steering while moving)
        if (Math.abs(controls.throttle) > 0.05) {
            positionRef.current.rotation += turnRate * Math.sign(controls.throttle);
        }

        // Update position based on current rotation
        positionRef.current.x += Math.sin(positionRef.current.rotation) * speed;
        positionRef.current.z += Math.cos(positionRef.current.rotation) * speed;

        // Apply to group
        groupRef.current.position.x = positionRef.current.x;
        groupRef.current.position.z = positionRef.current.z;
        groupRef.current.rotation.y = positionRef.current.rotation;
    });

    return (
        <group ref={groupRef}>
            <primitive object={clonedScene} scale={300} />
        </group>
    );
}

// Desktop Control Panel
function ControlPanel({
    controls,
    setControls
}: {
    controls: LoaderControls;
    setControls: React.Dispatch<React.SetStateAction<LoaderControls>>;
}) {
    return (
        <div className="absolute bottom-6 left-6 bg-zinc-900/95 backdrop-blur p-4 rounded-xl border border-amber-500/30 w-72">
            <h3 className="text-amber-400 font-bold mb-3 flex items-center gap-2">
                🚜 JCB CONTROLS
            </h3>

            {/* Lift Slider */}
            <div className="mb-3">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>LIFT</span>
                    <span>{Math.round(controls.lift * 100)}%</span>
                </div>
                <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={controls.lift}
                    onChange={(e) => setControls(prev => ({ ...prev, lift: parseFloat(e.target.value) }))}
                    className="w-full h-2 bg-zinc-800 rounded appearance-none cursor-pointer accent-amber-500"
                />
            </div>

            {/* Bucket Slider */}
            <div className="mb-3">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>BUCKET</span>
                    <span>{Math.round(controls.bucket * 100)}%</span>
                </div>
                <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={controls.bucket}
                    onChange={(e) => setControls(prev => ({ ...prev, bucket: parseFloat(e.target.value) }))}
                    className="w-full h-2 bg-zinc-800 rounded appearance-none cursor-pointer accent-amber-500"
                />
            </div>

            {/* Steering Slider */}
            <div className="mb-3">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>STEERING</span>
                    <span>{controls.steering > 0 ? "→" : controls.steering < 0 ? "←" : "○"} {Math.round(Math.abs(controls.steering) * 100)}%</span>
                </div>
                <input
                    type="range"
                    min={-1}
                    max={1}
                    step={0.01}
                    value={controls.steering}
                    onChange={(e) => setControls(prev => ({ ...prev, steering: parseFloat(e.target.value) }))}
                    className="w-full h-2 bg-zinc-800 rounded appearance-none cursor-pointer accent-blue-500"
                />
            </div>

            {/* Throttle Slider */}
            <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>THROTTLE</span>
                    <span>{controls.throttle > 0 ? "▲" : controls.throttle < 0 ? "▼" : "○"} {Math.round(Math.abs(controls.throttle) * 100)}%</span>
                </div>
                <input
                    type="range"
                    min={-1}
                    max={1}
                    step={0.01}
                    value={controls.throttle}
                    onChange={(e) => setControls(prev => ({ ...prev, throttle: parseFloat(e.target.value) }))}
                    className="w-full h-2 bg-zinc-800 rounded appearance-none cursor-pointer accent-green-500"
                />
            </div>
        </div>
    );
}

// Preload model
useGLTF.preload("/assets/jcb_435b_loader.glb");

export default function JCBLoaderPage() {
    usePeerHost();
    const { isConnected, sensorData } = useConnectionStore();

    const [controls, setControls] = useState<LoaderControls>({
        lift: 0,
        bucket: 0.5,
        steering: 0,
        throttle: 0,
    });

    // Update controls from phone
    useEffect(() => {
        const loaderData = sensorData.loader as LoaderControls | undefined;
        if (loaderData) {
            setControls(loaderData);
        }
    }, [sensorData]);

    return (
        <div className="h-screen w-full bg-zinc-950 overflow-hidden">
            <BackToLobby />

            {/* Header */}
            <div className="absolute top-4 left-16 z-10">
                <div className="flex items-center gap-3">
                    <span className="text-3xl">🚜</span>
                    <div>
                        <h1 className="text-xl font-bold text-amber-400">JCB 435B LOADER</h1>
                        <p className="text-[10px] text-zinc-500">WHEEL LOADER CONTROLLER</p>
                    </div>
                </div>
            </div>

            {/* Connection Status */}
            <div className="absolute top-4 right-4 z-10">
                <div className={`px-3 py-1 rounded-full text-xs flex items-center gap-2 ${isConnected ? "bg-green-500/20 text-green-400" : "bg-zinc-800 text-zinc-500"
                    }`}>
                    <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-zinc-600"}`} />
                    {isConnected ? "PHONE CONNECTED" : "DESKTOP MODE"}
                </div>
            </div>

            {/* 3D Canvas */}
            <Canvas shadows camera={{ position: [400, 300, 400], fov: 50 }}>
                <ambientLight intensity={0.4} />
                <directionalLight position={[300, 500, 300]} intensity={1.5} castShadow />
                <pointLight position={[-300, 300, -300]} intensity={0.5} color="#ffaa00" />

                <Suspense fallback={null}>
                    <JCBLoader controls={controls} />
                </Suspense>

                {/* Ground */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -10, 0]} receiveShadow>
                    <planeGeometry args={[1000, 1000]} />
                    <meshStandardMaterial color="#1a1a1a" />
                </mesh>

                <OrbitControls
                    minDistance={200}
                    maxDistance={1500}
                    target={[0, 100, 0]}
                />
                <gridHelper args={[1000, 50, "#333", "#222"]} position={[0, -9.99, 0]} />
                <Environment preset="warehouse" />
            </Canvas>

            {/* Desktop Controls */}
            <ControlPanel controls={controls} setControls={setControls} />

            {/* QR Code for Phone */}
            <QROverlay mode="loader" />
        </div>
    );
}
