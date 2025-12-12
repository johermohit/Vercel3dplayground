"use client";

import React, { Suspense, useRef, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { usePeerHost } from "@/hooks/usePeerHost";
import { useConnectionStore } from "@/store/connectionStore";
import QROverlay from "@/components/QROverlay";

// Dandelion seed with radiating filaments
interface Seed {
    id: number;
    basePosition: THREE.Vector3;
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    rotation: THREE.Euler;
    rotationSpeed: THREE.Vector3;
    scale: number;
    opacity: number;
    detached: boolean;
    filamentCount: number;
}

// Single seed component with starburst filaments
function DandelionSeed({ seed }: { seed: Seed }) {
    const filaments = useMemo(() => {
        const lines: THREE.Vector3[][] = [];
        const count = seed.filamentCount;

        for (let i = 0; i < count; i++) {
            // Fibonacci sphere distribution for even spacing
            const phi = Math.acos(1 - 2 * (i + 0.5) / count);
            const theta = Math.PI * (1 + Math.sqrt(5)) * i;

            const length = 0.12 + Math.random() * 0.06;
            const x = Math.sin(phi) * Math.cos(theta) * length;
            const y = Math.cos(phi) * length;
            const z = Math.sin(phi) * Math.sin(theta) * length;

            // Line from center to tip
            lines.push([
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(x, y, z)
            ]);
        }
        return lines;
    }, [seed.filamentCount]);

    if (seed.opacity <= 0) return null;

    return (
        <group
            position={seed.position.toArray()}
            rotation={seed.rotation.toArray() as [number, number, number]}
            scale={seed.scale}
        >
            {/* Radiating filaments */}
            {filaments.map((line, i) => (
                <Line
                    key={i}
                    points={line}
                    color="#ffffff"
                    lineWidth={0.5}
                    transparent
                    opacity={seed.opacity * 0.85}
                />
            ))}
            {/* Tiny seed body at center */}
            <mesh position={[0, -0.02, 0]}>
                <sphereGeometry args={[0.008, 6, 6]} />
                <meshBasicMaterial color="#8B7355" transparent opacity={seed.opacity} />
            </mesh>
            {/* Tiny stem connecting to filaments */}
            <mesh position={[0, -0.035, 0]}>
                <cylinderGeometry args={[0.002, 0.003, 0.03, 4]} />
                <meshBasicMaterial color="#9a8565" transparent opacity={seed.opacity} />
            </mesh>
        </group>
    );
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
        const seedCount = 80;

        for (let i = 0; i < seedCount; i++) {
            // Fibonacci sphere distribution
            const phi = Math.acos(1 - 2 * (i + 0.5) / seedCount);
            const theta = Math.PI * (1 + Math.sqrt(5)) * i;

            const radius = 0.45 + Math.random() * 0.15;
            const x = Math.sin(phi) * Math.cos(theta) * radius;
            const y = Math.cos(phi) * radius * 0.9 + 0.3; // Squash slightly, offset up
            const z = Math.sin(phi) * Math.sin(theta) * radius;

            const basePos = new THREE.Vector3(x, y, z);

            newSeeds.push({
                id: i,
                basePosition: basePos.clone(),
                position: basePos.clone(),
                velocity: new THREE.Vector3(0, 0, 0),
                rotation: new THREE.Euler(
                    Math.atan2(z, x),
                    phi - Math.PI / 2,
                    Math.random() * Math.PI * 2
                ),
                rotationSpeed: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.02,
                    (Math.random() - 0.5) * 0.02,
                    (Math.random() - 0.5) * 0.05
                ),
                scale: 0.9 + Math.random() * 0.3,
                opacity: 1,
                detached: false,
                filamentCount: 12 + Math.floor(Math.random() * 6),
            });
        }

        seedsRef.current = newSeeds;
        setSeeds(newSeeds);
    }, []);

    useFrame((state, delta) => {
        const { sensorData, isConnected } = useConnectionStore.getState();
        const blow = sensorData.blow;

        // Phase transitions
        if (!isConnected && phase !== 'waiting' && phase !== 'done') {
            setPhase('waiting');
        } else if (isConnected && phase === 'waiting') {
            setPhase('ready');
        }

        // Accumulate blow
        if (blow?.isBlowing && phase !== 'done') {
            const blowAmount = blow.intensity * delta * 0.6;
            const newProgress = Math.min(1, blowProgress + blowAmount);
            setBlowProgress(newProgress);

            if (phase === 'ready') setPhase('blowing');

            // Detach seeds
            const detachCount = Math.floor(newProgress * seedsRef.current.length);
            seedsRef.current.forEach((seed, i) => {
                if (!seed.detached && i < detachCount) {
                    seed.detached = true;
                    // Blow velocity: mostly upward and to the right
                    seed.velocity.set(
                        0.3 + Math.random() * 0.8,
                        0.5 + Math.random() * 1.2,
                        (Math.random() - 0.5) * 0.4
                    );
                }
            });

            if (newProgress >= 1) setPhase('done');
        }

        // Physics for detached seeds
        seedsRef.current.forEach(seed => {
            if (seed.detached) {
                // Gentle gravity
                seed.velocity.y -= delta * 0.15;
                // Wind drift
                seed.velocity.x += Math.sin(state.clock.elapsedTime * 2 + seed.id) * delta * 0.1;
                // Damping
                seed.velocity.multiplyScalar(0.995);

                seed.position.add(seed.velocity.clone().multiplyScalar(delta * 2));

                // Tumble rotation
                seed.rotation.x += seed.rotationSpeed.x;
                seed.rotation.y += seed.rotationSpeed.y;
                seed.rotation.z += seed.rotationSpeed.z;

                // Fade based on distance
                const dist = seed.position.length();
                seed.opacity = Math.max(0, 1 - (dist - 1.5) * 0.3);
            }
        });

        // Gentle sway
        if (groupRef.current && phase !== 'done') {
            groupRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.3) * 0.015;
        }

        setSeeds([...seedsRef.current]);
    });

    return (
        <group ref={groupRef}>
            {/* Stem */}
            <mesh position={[0, -1.2, 0]}>
                <cylinderGeometry args={[0.02, 0.035, 2.2, 8]} />
                <meshStandardMaterial color="#4a7c4a" roughness={0.8} />
            </mesh>

            {/* Receptacle (bud base) */}
            <mesh position={[0, 0.08, 0]}>
                <sphereGeometry args={[0.12, 16, 16]} />
                <meshStandardMaterial color="#a89060" roughness={0.7} />
            </mesh>

            {/* Sepals (small leaves around base) */}
            {[0, 1, 2, 3, 4].map(i => (
                <mesh
                    key={i}
                    position={[
                        Math.cos(i * Math.PI * 2 / 5) * 0.08,
                        -0.05,
                        Math.sin(i * Math.PI * 2 / 5) * 0.08
                    ]}
                    rotation={[0.3, i * Math.PI * 2 / 5, 0]}
                >
                    <coneGeometry args={[0.03, 0.12, 4]} />
                    <meshStandardMaterial color="#5a8a4a" roughness={0.8} />
                </mesh>
            ))}

            {/* Seeds */}
            {seeds.map(seed => (
                <DandelionSeed key={seed.id} seed={seed} />
            ))}
        </group>
    );
}

function SceneContent() {
    usePeerHost();

    return (
        <>
            <ambientLight intensity={0.4} />
            <directionalLight position={[3, 5, 2]} intensity={0.8} color="#fff5e6" />
            <directionalLight position={[-2, 3, -1]} intensity={0.3} color="#e6f0ff" />
            <DandelionScene />
        </>
    );
}

export default function MakeAWishPage() {
    const { sensorData, isConnected } = useConnectionStore();
    const blow = sensorData.blow;
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        if (blow?.isBlowing) {
            setProgress(prev => Math.min(1, prev + blow.intensity * 0.015));
        }
    }, [blow]);

    const isDone = progress >= 0.99;

    return (
        <div className="h-full w-full bg-gradient-to-b from-neutral-700 via-neutral-600 to-neutral-500 text-white overflow-hidden">
            <QROverlay mode="blow" />

            {/* Header */}
            <div className="absolute top-0 left-0 right-0 p-5 z-10 flex justify-between items-start">
                <div className="pointer-events-none">
                    <h1 className="text-3xl font-light tracking-wide text-white/90">Make a Wish</h1>
                    <p className="text-xs text-white/50 mt-1 tracking-wider">
                        {!isConnected
                            ? "Connect your phone..."
                            : isDone
                                ? "✨ Your wish floats on the wind"
                                : "Blow gently to scatter your wish"
                        }
                    </p>
                </div>
                <Link href="/" className="text-white/40 hover:text-white/80 text-xs transition-colors">← back</Link>
            </div>

            {/* Progress ring */}
            {isConnected && !isDone && (
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                    <div className="relative w-16 h-16">
                        <svg className="w-full h-full -rotate-90">
                            <circle
                                cx="32" cy="32" r="28"
                                fill="none"
                                stroke="rgba(255,255,255,0.15)"
                                strokeWidth="2"
                            />
                            <circle
                                cx="32" cy="32" r="28"
                                fill="none"
                                stroke="rgba(255,255,255,0.6)"
                                strokeWidth="2"
                                strokeDasharray={`${progress * 175.9} 175.9`}
                                strokeLinecap="round"
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className={`text-2xl ${blow?.isBlowing ? 'animate-pulse' : ''}`}>
                                {blow?.isBlowing ? '💨' : '🌬️'}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Done message */}
            {isDone && (
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 pointer-events-none text-center">
                    <p className="text-white/70 text-sm font-light tracking-wide">
                        May your wish come true
                    </p>
                </div>
            )}

            <Canvas camera={{ position: [0, 0.3, 3.5], fov: 35 }}>
                <Suspense fallback={null}>
                    <SceneContent />
                </Suspense>
            </Canvas>
        </div>
    );
}
