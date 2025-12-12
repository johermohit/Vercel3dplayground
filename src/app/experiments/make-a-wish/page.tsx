"use client";

import React, { Suspense, useRef, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Canvas, useFrame } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { usePeerHost } from "@/hooks/usePeerHost";
import { useConnectionStore } from "@/store/connectionStore";
import QROverlay from "@/components/QROverlay";

interface Seed {
    id: number;
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    rotationSpeed: THREE.Vector3;
    opacity: number;
    detached: boolean;
    direction: THREE.Vector3;
}

function DandelionSeed({ seed }: { seed: Seed }) {
    const filaments = useMemo(() => {
        const lines: THREE.Vector3[][] = [];
        const count = 24;

        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const spreadAngle = 0.15 + Math.random() * 0.35;
            const length = 0.11 + Math.random() * 0.05;

            const x = Math.cos(angle) * Math.sin(spreadAngle) * length;
            const y = Math.cos(spreadAngle) * length;
            const z = Math.sin(angle) * Math.sin(spreadAngle) * length;

            lines.push([
                new THREE.Vector3(0, 0.065, 0),
                new THREE.Vector3(x, 0.065 + y, z)
            ]);
        }
        return lines;
    }, []);

    if (seed.opacity <= 0) return null;

    return (
        <group
            position={seed.position.toArray()}
            quaternion={new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 1, 0),
                seed.direction.clone().normalize()
            )}
        >
            <mesh position={[0, 0.008, 0]}>
                <cylinderGeometry args={[0.0015, 0.004, 0.018, 4]} />
                <meshStandardMaterial color="#9a7530" roughness={0.6} />
            </mesh>

            <Line
                points={[new THREE.Vector3(0, 0.017, 0), new THREE.Vector3(0, 0.065, 0)]}
                color="#f5f5f0"
                lineWidth={0.15}
                transparent
                opacity={seed.opacity * 0.8}
            />

            {filaments.map((line, i) => (
                <Line key={i} points={line} color="#ffffff" lineWidth={0.15} transparent opacity={seed.opacity * 0.6} />
            ))}
        </group>
    );
}

// Sepal component - curved leaf-like structure
function Sepal({ angle, tilt }: { angle: number; tilt: number }) {
    const curve = useMemo(() => {
        const points = [];
        for (let t = 0; t <= 1; t += 0.1) {
            const y = -t * 0.08;
            const outward = t * 0.035 + t * t * 0.02;
            points.push(new THREE.Vector3(outward, y, 0));
        }
        return new THREE.CatmullRomCurve3(points);
    }, []);

    return (
        <group rotation={[tilt, angle, 0]}>
            <mesh>
                <tubeGeometry args={[curve, 8, 0.006, 6, false]} />
                <meshStandardMaterial color="#8B6914" roughness={0.75} />
            </mesh>
            {/* Sepal tip */}
            <mesh position={[0.055, -0.08, 0]} rotation={[0, 0, -0.5]}>
                <coneGeometry args={[0.008, 0.025, 4]} />
                <meshStandardMaterial color="#7A5C12" roughness={0.8} />
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

    const receptacleRadius = 0.045;

    useEffect(() => {
        const newSeeds: Seed[] = [];
        const seedCount = 200;

        for (let i = 0; i < seedCount; i++) {
            const phi = Math.acos(1 - 2 * (i + 0.5) / seedCount);
            const theta = Math.PI * (1 + Math.sqrt(5)) * i;

            const x = Math.sin(phi) * Math.cos(theta);
            const y = Math.cos(phi);
            const z = Math.sin(phi) * Math.sin(theta);

            if (y < -0.08) continue;

            const direction = new THREE.Vector3(x, y, z).normalize();
            const basePos = direction.clone().multiplyScalar(receptacleRadius);
            basePos.y += 0.015;

            newSeeds.push({
                id: i,
                position: basePos.clone(),
                velocity: new THREE.Vector3(0, 0, 0),
                rotationSpeed: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.04,
                    (Math.random() - 0.5) * 0.04,
                    (Math.random() - 0.5) * 0.06
                ),
                opacity: 1,
                detached: false,
                direction: direction,
            });
        }

        seedsRef.current = newSeeds;
        setSeeds(newSeeds);
    }, []);

    useFrame((state, delta) => {
        const { sensorData, isConnected } = useConnectionStore.getState();
        const blow = sensorData.blow;

        if (!isConnected && phase !== 'waiting' && phase !== 'done') setPhase('waiting');
        else if (isConnected && phase === 'waiting') setPhase('ready');

        if (blow?.isBlowing && phase !== 'done') {
            const newProgress = Math.min(1, blowProgress + blow.intensity * delta * 0.35);
            setBlowProgress(newProgress);
            if (phase === 'ready') setPhase('blowing');

            const detachCount = Math.floor(newProgress * seedsRef.current.length);
            seedsRef.current.forEach((seed, i) => {
                if (!seed.detached && i < detachCount) {
                    seed.detached = true;
                    seed.velocity.set(
                        seed.direction.x * 0.25 + (Math.random() - 0.3) * 0.25,
                        0.4 + Math.random() * 0.35,
                        seed.direction.z * 0.15 + (Math.random() - 0.5) * 0.15
                    );
                }
            });
            if (newProgress >= 1) setPhase('done');
        }

        seedsRef.current.forEach(seed => {
            if (seed.detached) {
                seed.velocity.y -= delta * 0.03;
                seed.velocity.x += Math.sin(state.clock.elapsedTime * 1.5 + seed.id) * delta * 0.04;
                seed.velocity.multiplyScalar(0.998);
                seed.position.add(seed.velocity.clone().multiplyScalar(delta * 2));
                seed.direction.applyAxisAngle(new THREE.Vector3(1, 0, 0), seed.rotationSpeed.x);
                seed.direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), seed.rotationSpeed.y);
                seed.opacity = Math.max(0, 1 - (seed.position.length() - 0.4) * 0.4);
            }
        });

        setSeeds([...seedsRef.current]);
    });

    return (
        <group ref={groupRef}>
            {/* Stem */}
            <mesh position={[0, -0.5, 0]}>
                <cylinderGeometry args={[0.01, 0.018, 1.1, 12]} />
                <meshStandardMaterial color="#4a7a3a" roughness={0.85} metalness={0.05} />
            </mesh>

            {/* Stem detail */}
            {[0, 1, 2, 3].map(i => (
                <mesh key={i} position={[0, -0.5, 0]} rotation={[0, (i * Math.PI) / 2, 0]}>
                    <cylinderGeometry args={[0.0115, 0.019, 1.1, 4]} />
                    <meshStandardMaterial color="#3a6a2a" roughness={0.9} transparent opacity={0.3} />
                </mesh>
            ))}

            {/* Sepals - brownish curved structures */}
            <group position={[0, 0.01, 0]}>
                {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
                    <Sepal key={i} angle={(i * Math.PI * 2) / 8} tilt={0.3 + (i % 2) * 0.15} />
                ))}
            </group>

            {/* Stem connector */}
            <mesh position={[0, 0.03, 0]} rotation={[Math.PI, 0, 0]}>
                <coneGeometry args={[0.016, 0.035, 8]} />
                <meshStandardMaterial color="#5a8a4a" roughness={0.7} />
            </mesh>

            {/* Receptacle */}
            <mesh position={[0, 0.015, 0]}>
                <sphereGeometry args={[receptacleRadius, 20, 20]} />
                <meshStandardMaterial color="#a89040" roughness={0.55} metalness={0.1} />
            </mesh>

            {/* Seeds */}
            {seeds.map(seed => <DandelionSeed key={seed.id} seed={seed} />)}
        </group>
    );
}

function SceneContent() {
    usePeerHost();
    return (
        <>
            <directionalLight position={[5, 8, 4]} intensity={1.2} color="#fff8e8" />
            <directionalLight position={[-4, 5, -3]} intensity={0.5} color="#e0f0ff" />
            <directionalLight position={[0, 3, -5]} intensity={0.4} color="#ffffff" />
            <ambientLight intensity={0.4} />
            <DandelionScene />
            {/* User can rotate! */}
            <OrbitControls
                enableZoom={true}
                enablePan={false}
                minDistance={0.8}
                maxDistance={3}
                minPolarAngle={Math.PI * 0.2}
                maxPolarAngle={Math.PI * 0.8}
            />
        </>
    );
}

export default function MakeAWishPage() {
    const { sensorData, isConnected } = useConnectionStore();
    const blow = sensorData.blow;
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        if (blow?.isBlowing) setProgress(prev => Math.min(1, prev + blow.intensity * 0.008));
    }, [blow]);

    const isDone = progress >= 0.99;

    return (
        <div className="h-full w-full overflow-hidden relative">
            <div
                className="absolute inset-0"
                style={{
                    background: `linear-gradient(170deg,
                        #c5d8e8 0%, #d0dfe5 20%, #b8c9b5 45%,
                        #9ab89a 65%, #7a9a78 85%, #5a7a58 100%
                    )`,
                    filter: 'blur(60px)',
                    opacity: 0.7,
                }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-black/20" />

            <QROverlay mode="blow" />

            <div className="absolute top-0 left-0 right-0 p-5 z-10 flex justify-between items-start">
                <div className="pointer-events-none">
                    <h1 className="text-3xl font-light text-gray-800 drop-shadow-sm">Make a Wish</h1>
                    <p className="text-xs text-gray-600 mt-1">
                        {!isConnected ? "Connect phone..." : isDone ? "✨ Wish away" : "Blow gently... (drag to rotate)"}
                    </p>
                </div>
                <Link href="/" className="text-gray-500 hover:text-gray-800 text-xs">← back</Link>
            </div>

            {isConnected && !isDone && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
                    <div className="relative w-14 h-14">
                        <svg className="w-full h-full -rotate-90">
                            <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="2" />
                            <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(80,100,80,0.7)" strokeWidth="2"
                                strokeDasharray={`${progress * 150.8} 150.8`} strokeLinecap="round" />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center text-xl">
                            {blow?.isBlowing ? '💨' : '🌬️'}
                        </div>
                    </div>
                </div>
            )}

            {isDone && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 text-center">
                    <p className="text-gray-600 text-sm italic">May your wish come true</p>
                </div>
            )}

            <Canvas camera={{ position: [0, 0.1, 1.5], fov: 45 }}>
                <Suspense fallback={null}><SceneContent /></Suspense>
            </Canvas>
        </div>
    );
}
