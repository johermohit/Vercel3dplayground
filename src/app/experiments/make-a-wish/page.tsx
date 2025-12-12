"use client";

import React, { Suspense, useRef, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { usePeerHost } from "@/hooks/usePeerHost";
import { useConnectionStore } from "@/store/connectionStore";
import QROverlay from "@/components/QROverlay";

// Single dandelion seed particle
interface Seed {
    id: number;
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    rotation: number;
    rotationSpeed: number;
    scale: number;
    opacity: number;
    detached: boolean;
    angle: number; // Position on the sphere
}

function DandelionScene() {
    const groupRef = useRef<THREE.Group>(null);
    const seedsRef = useRef<Seed[]>([]);
    const [seeds, setSeeds] = useState<Seed[]>([]);
    const [blowProgress, setBlowProgress] = useState(0);
    const [phase, setPhase] = useState<'waiting' | 'ready' | 'blowing' | 'done'>('waiting');

    // Create seeds on mount
    useEffect(() => {
        const newSeeds: Seed[] = [];
        const seedCount = 60;

        for (let i = 0; i < seedCount; i++) {
            // Distribute seeds on a sphere
            const phi = Math.acos(-1 + (2 * i) / seedCount);
            const theta = Math.sqrt(seedCount * Math.PI) * phi;

            const radius = 0.8;
            const x = radius * Math.cos(theta) * Math.sin(phi);
            const y = radius * Math.sin(theta) * Math.sin(phi) + 0.5;
            const z = radius * Math.cos(phi);

            newSeeds.push({
                id: i,
                position: new THREE.Vector3(x, y, z),
                velocity: new THREE.Vector3(0, 0, 0),
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.1,
                scale: 0.8 + Math.random() * 0.4,
                opacity: 1,
                detached: false,
                angle: theta,
            });
        }

        seedsRef.current = newSeeds;
        setSeeds(newSeeds);
    }, []);

    // Track blow and update seeds
    useFrame((state, delta) => {
        const { sensorData, isConnected } = useConnectionStore.getState();
        const blow = sensorData.blow;

        // Update phase based on connection
        if (!isConnected && phase !== 'waiting' && phase !== 'done') {
            setPhase('waiting');
        } else if (isConnected && phase === 'waiting') {
            setPhase('ready');
        }

        // Accumulate blow progress
        if (blow?.isBlowing && phase !== 'done') {
            const blowAmount = blow.intensity * delta * 0.8;
            const newProgress = Math.min(1, blowProgress + blowAmount);
            setBlowProgress(newProgress);

            if (phase === 'ready') {
                setPhase('blowing');
            }

            // Detach seeds based on progress
            const detachThreshold = Math.floor(newProgress * seedsRef.current.length);
            seedsRef.current.forEach((seed, i) => {
                if (!seed.detached && i < detachThreshold) {
                    seed.detached = true;
                    // Give initial velocity (blow direction + random)
                    seed.velocity.set(
                        (Math.random() - 0.3) * 2,
                        Math.random() * 1.5 + 0.5,
                        (Math.random() - 0.5) * 0.5
                    );
                }
            });

            if (newProgress >= 1 && phase !== 'done') {
                setPhase('done');
            }
        }

        // Update detached seeds physics
        seedsRef.current.forEach(seed => {
            if (seed.detached) {
                // Apply gravity and drift
                seed.velocity.y -= delta * 0.3;
                seed.velocity.x += Math.sin(state.clock.elapsedTime + seed.id) * delta * 0.2;

                // Update position
                seed.position.add(seed.velocity.clone().multiplyScalar(delta * 2));

                // Rotation
                seed.rotation += seed.rotationSpeed;

                // Fade out as they fly away
                const dist = seed.position.length();
                seed.opacity = Math.max(0, 1 - (dist - 2) * 0.2);
            }
        });

        // Gentle sway for attached seeds
        if (groupRef.current) {
            groupRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.5) * 0.02;
        }

        setSeeds([...seedsRef.current]);
    });

    return (
        <group ref={groupRef}>
            {/* Stem */}
            <mesh position={[0, -1.5, 0]}>
                <cylinderGeometry args={[0.03, 0.04, 2.5, 8]} />
                <meshBasicMaterial color="#3a5a3a" />
            </mesh>

            {/* Bud/center */}
            <mesh position={[0, 0.2, 0]}>
                <sphereGeometry args={[0.15, 16, 16]} />
                <meshBasicMaterial color="#8B7355" />
            </mesh>

            {/* Seeds */}
            {seeds.map((seed) => (
                <group
                    key={seed.id}
                    position={seed.position.toArray()}
                    rotation={[0, seed.rotation, 0]}
                    scale={seed.scale}
                >
                    {/* Seed filaments (parachute) */}
                    <mesh>
                        <coneGeometry args={[0.15, 0.02, 8]} />
                        <meshBasicMaterial
                            color="#ffffff"
                            transparent
                            opacity={seed.opacity * 0.9}
                            side={THREE.DoubleSide}
                        />
                    </mesh>
                    {/* Seed body */}
                    <mesh position={[0, -0.05, 0]}>
                        <cylinderGeometry args={[0.005, 0.01, 0.1, 4]} />
                        <meshBasicMaterial
                            color="#654321"
                            transparent
                            opacity={seed.opacity}
                        />
                    </mesh>
                </group>
            ))}
        </group>
    );
}

function SceneContent() {
    usePeerHost();

    return (
        <>
            <ambientLight intensity={0.6} />
            <directionalLight position={[5, 5, 5]} intensity={0.8} />
            <DandelionScene />
        </>
    );
}

export default function MakeAWishPage() {
    const { sensorData, isConnected } = useConnectionStore();
    const blow = sensorData.blow;
    const [progress, setProgress] = useState(0);

    // Calculate visual progress
    useEffect(() => {
        if (blow?.isBlowing) {
            setProgress(prev => Math.min(1, prev + blow.intensity * 0.02));
        }
    }, [blow]);

    const isDone = progress >= 0.99;

    return (
        <div className="h-full w-full bg-gradient-to-b from-sky-200 via-sky-100 to-amber-50 text-gray-800 overflow-hidden">
            <QROverlay mode="blow" />

            {/* Header */}
            <div className="absolute top-0 left-0 right-0 p-4 z-10 flex justify-between items-start">
                <div className="pointer-events-none">
                    <h1 className="text-2xl font-serif italic text-gray-600">Make a Wish</h1>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                        {!isConnected
                            ? "Connect your phone to make a wish..."
                            : isDone
                                ? "Your wish is carried by the wind ✨"
                                : "Blow gently on your phone..."
                        }
                    </p>
                </div>
                <Link href="/" className="text-gray-400 hover:text-gray-600 text-xs">← back</Link>
            </div>

            {/* Progress indicator */}
            {isConnected && !isDone && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                    <div className="w-32 h-1 bg-white/50 rounded-full overflow-hidden backdrop-blur-sm">
                        <div
                            className="h-full bg-white/80 rounded-full transition-all duration-300"
                            style={{ width: `${progress * 100}%` }}
                        />
                    </div>
                    <p className="text-[10px] text-gray-400 text-center mt-2">
                        {blow?.isBlowing ? "💨 blowing..." : "blow to scatter seeds"}
                    </p>
                </div>
            )}

            {/* Wish complete message */}
            {isDone && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 pointer-events-none text-center">
                    <p className="text-gray-500 text-sm italic">
                        May your wish come true
                    </p>
                </div>
            )}

            <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
                <Suspense fallback={null}>
                    <SceneContent />
                </Suspense>
            </Canvas>
        </div>
    );
}
