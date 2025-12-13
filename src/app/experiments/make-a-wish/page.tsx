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
        const count = 26;

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

            {/* Pedicel (stem) */}
            <Line
                points={[new THREE.Vector3(0, 0.017, 0), new THREE.Vector3(0, 0.065, 0)]}
                color="#f5f5f0"
                lineWidth={0.25}
                transparent
                opacity={seed.opacity * 0.85}
            />

            {/* Pappus filaments */}
            {filaments.map((line, i) => (
                <Line key={i} points={line} color="#ffffff" lineWidth={0.22} transparent opacity={seed.opacity * 0.65} />
            ))}
        </group>
    );
}

// Organic sepal - hangs DOWN below the receptacle
function OrganicSepal({ angle, lengthMod, curveMod }: { angle: number; lengthMod: number; curveMod: number }) {
    const geometry = useMemo(() => {
        const shape = new THREE.Shape();
        const len = 0.12 * lengthMod;
        // Leaf shape pointing down (-Y)
        shape.moveTo(0, 0);
        shape.bezierCurveTo(0.005, -len * 0.3, 0.006, -len * 0.6, 0.003, -len);
        shape.lineTo(0, -len - 0.01);
        shape.bezierCurveTo(-0.003, -len, -0.006, -len * 0.6, -0.005, -len * 0.3);
        shape.lineTo(0, 0);

        const extrudeSettings = { depth: 0.001, bevelEnabled: false };
        return new THREE.ExtrudeGeometry(shape, extrudeSettings);
    }, [lengthMod]);

    // First rotate around Y to position around stem, then tilt outward on X
    return (
        <group rotation={[0, angle, 0]}>
            <group rotation={[0.35 + curveMod * 0.2, 0, Math.sin(angle * 3) * 0.08]} position={[0.02, 0, 0]}>
                <mesh geometry={geometry}>
                    <meshStandardMaterial
                        color="#8a9a45"
                        roughness={0.7}
                        side={THREE.DoubleSide}
                    />
                </mesh>
            </group>
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
        const seedCount = 250;

        for (let i = 0; i < seedCount; i++) {
            const phi = Math.acos(1 - 2 * (i + 0.5) / seedCount);
            const theta = Math.PI * (1 + Math.sqrt(5)) * i;

            const x = Math.sin(phi) * Math.cos(theta);
            const y = Math.cos(phi);
            const z = Math.sin(phi) * Math.sin(theta);

            if (y < -0.05) continue;

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

    const sepals = useMemo(() => {
        const arr = [];
        const count = 14;
        for (let i = 0; i < count; i++) {
            arr.push({
                angle: (i / count) * Math.PI * 2 + Math.random() * 0.15,
                lengthMod: 0.9 + Math.random() * 0.4,
                curveMod: Math.random(),
            });
        }
        return arr;
    }, []);

    return (
        <group ref={groupRef}>
            {/* Main stem */}
            <mesh position={[0, -0.48, 0]}>
                <cylinderGeometry args={[0.012, 0.02, 1.0, 16]} />
                <meshStandardMaterial color="#6a8a4a" roughness={0.75} />
            </mesh>

            {/* Stem collar - where sepals attach */}
            <mesh position={[0, 0.015, 0]}>
                <cylinderGeometry args={[0.022, 0.016, 0.025, 16]} />
                <meshStandardMaterial color="#7a9a5a" roughness={0.7} />
            </mesh>

            {/* Sepals - positioned at base of receptacle, hanging DOWN */}
            <group position={[0, -0.005, 0]}>
                {sepals.map((s, i) => (
                    <OrganicSepal key={i} angle={s.angle} lengthMod={s.lengthMod} curveMod={s.curveMod} />
                ))}
            </group>

            {/* Receptacle */}
            <mesh position={[0, 0.015, 0]}>
                <sphereGeometry args={[receptacleRadius, 24, 24]} />
                <meshStandardMaterial color="#c8b060" roughness={0.5} metalness={0.05} />
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
            <ambientLight intensity={0.45} />
            <DandelionScene />
            <OrbitControls
                enableZoom={true}
                enablePan={false}
                minDistance={0.6}
                maxDistance={2.5}
                minPolarAngle={Math.PI * 0.15}
                maxPolarAngle={Math.PI * 0.85}
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
                        #d5e3ed 0%, #dce8e5 25%, #c8d9c5 50%,
                        #aac8aa 75%, #8aaa88 100%
                    )`,
                    filter: 'blur(50px)',
                    opacity: 0.65,
                }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-black/15" />

            <QROverlay mode="blow" />

            <div className="absolute top-0 left-0 right-0 p-5 z-10 flex justify-between items-start">
                <div className="pointer-events-none">
                    <h1 className="text-3xl font-light text-gray-700">Make a Wish</h1>
                    <p className="text-xs text-gray-500 mt-1">
                        {!isConnected ? "Connect phone..." : isDone ? "✨ Wish away" : "Blow gently... drag to rotate"}
                    </p>
                </div>
                <Link href="/" className="text-gray-400 hover:text-gray-700 text-xs">← back</Link>
            </div>

            {isConnected && !isDone && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
                    <div className="relative w-14 h-14">
                        <svg className="w-full h-full -rotate-90">
                            <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="2" />
                            <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(90,120,90,0.6)" strokeWidth="2"
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
                    <p className="text-gray-500 text-sm italic">May your wish come true</p>
                </div>
            )}

            <Canvas camera={{ position: [0, 0.05, 1.3], fov: 45 }}>
                <Suspense fallback={null}><SceneContent /></Suspense>
            </Canvas>
        </div>
    );
}
