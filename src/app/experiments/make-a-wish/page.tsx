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
    basePosition: THREE.Vector3;
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    rotationSpeed: THREE.Vector3;
    opacity: number;
    detached: boolean;
    direction: THREE.Vector3;
    agitation: number; // How much this seed is shaking from wind
}

function DandelionSeed({ seed, intensity }: { seed: Seed; intensity: number }) {
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

    // Apply agitation shake when wind blows (before detaching)
    const shake = !seed.detached && intensity > 0.1
        ? new THREE.Vector3(
            Math.sin(Date.now() * 0.02 + seed.id) * intensity * 0.008,
            Math.cos(Date.now() * 0.015 + seed.id * 2) * intensity * 0.005,
            Math.sin(Date.now() * 0.018 + seed.id * 3) * intensity * 0.006
        )
        : new THREE.Vector3(0, 0, 0);

    const displayPos = seed.position.clone().add(shake);

    return (
        <group
            position={displayPos.toArray()}
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
                lineWidth={0.25}
                transparent
                opacity={seed.opacity * 0.85}
            />

            {filaments.map((line, i) => (
                <Line key={i} points={line} color="#ffffff" lineWidth={0.22} transparent opacity={seed.opacity * 0.65} />
            ))}
        </group>
    );
}

function OrganicSepal({ angle, lengthMod, curveMod }: { angle: number; lengthMod: number; curveMod: number }) {
    const geometry = useMemo(() => {
        const shape = new THREE.Shape();
        const len = 0.12 * lengthMod;
        shape.moveTo(0, 0);
        shape.bezierCurveTo(0.005, -len * 0.3, 0.006, -len * 0.6, 0.003, -len);
        shape.lineTo(0, -len - 0.01);
        shape.bezierCurveTo(-0.003, -len, -0.006, -len * 0.6, -0.005, -len * 0.3);
        shape.lineTo(0, 0);

        const extrudeSettings = { depth: 0.001, bevelEnabled: false };
        return new THREE.ExtrudeGeometry(shape, extrudeSettings);
    }, [lengthMod]);

    return (
        <group rotation={[0, angle, 0]}>
            <group rotation={[0.35 + curveMod * 0.2, 0, Math.sin(angle * 3) * 0.08]} position={[0.02, 0, 0]}>
                <mesh geometry={geometry}>
                    <meshStandardMaterial color="#8a9a45" roughness={0.7} side={THREE.DoubleSide} />
                </mesh>
            </group>
        </group>
    );
}

function DandelionScene() {
    const groupRef = useRef<THREE.Group>(null);
    const seedsRef = useRef<Seed[]>([]);
    const [seeds, setSeeds] = useState<Seed[]>([]);
    const [currentIntensity, setCurrentIntensity] = useState(0);
    const detachQueueRef = useRef<number[]>([]);
    const lastDetachTimeRef = useRef(0);

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
                basePosition: basePos.clone(),
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
                agitation: 0,
            });
        }

        seedsRef.current = newSeeds;
        setSeeds(newSeeds);
    }, []);

    useFrame((state, delta) => {
        const { sensorData, isConnected } = useConnectionStore.getState();
        const blow = sensorData.blow;
        const time = state.clock.elapsedTime;
        const now = Date.now();

        // Get camera position for dynamic front-facing calculation
        const cameraPos = state.camera.position.clone();
        const cameraDir = cameraPos.clone().normalize();

        // Get real-time intensity (not just isBlowing boolean)
        const intensity = blow?.intensity ?? 0;
        setCurrentIntensity(intensity);

        // REAL-TIME SEED DETACHMENT: While blowing, queue seeds to detach
        if (intensity > 0.15 && isConnected) {
            // Detach rate based on intensity (stronger blow = faster detach)
            const detachInterval = Math.max(30, 200 - intensity * 150); // 30-200ms between detaches

            if (now - lastDetachTimeRef.current > detachInterval) {
                // Find next attached seed to detach
                const attachedSeeds = seedsRef.current.filter(s => !s.detached);
                if (attachedSeeds.length > 0) {
                    // Calculate which seeds are FACING the camera (dot product > 0)
                    // These are the seeds visible to the user, hit by wind first
                    const frontSeeds = attachedSeeds.filter(s => {
                        const dotProduct = s.direction.dot(cameraDir);
                        return dotProduct > 0.2; // Facing camera
                    });

                    // Pick from front-facing seeds, or any if none left
                    const candidates = frontSeeds.length > 0 ? frontSeeds : attachedSeeds;
                    const target = candidates[Math.floor(Math.random() * Math.min(5, candidates.length))];

                    target.detached = true;

                    // Wind comes FROM camera, seeds fly AWAY (opposite of camera direction)
                    const windPower = 0.4 + intensity * 0.6;
                    const awayDir = cameraDir.clone().multiplyScalar(-1); // Away from camera

                    target.velocity.set(
                        awayDir.x * windPower + (Math.random() - 0.5) * 0.2,
                        awayDir.y * windPower + 0.1 + Math.random() * 0.25,
                        awayDir.z * windPower + (Math.random() - 0.5) * 0.1
                    );
                    lastDetachTimeRef.current = now;
                }
            }
        }

        // Physics for all seeds
        seedsRef.current.forEach(seed => {
            if (seed.detached) {
                // Flying seed physics
                seed.velocity.y -= delta * 0.008; // Very gentle gravity (parachute effect)

                // Wind continues pushing seeds AWAY from camera
                const awayDir = cameraDir.clone().multiplyScalar(-1);
                seed.velocity.x += awayDir.x * intensity * delta * 0.2;
                seed.velocity.z += awayDir.z * intensity * delta * 0.2;

                // Breeze oscillation (side to side drift)
                seed.velocity.x += Math.sin(time * 0.7 + seed.id * 0.1) * 0.012 * delta;

                // Air drag
                seed.velocity.multiplyScalar(0.994);

                // Terminal velocity
                if (seed.velocity.y < -0.08) seed.velocity.y = -0.08;

                // Update position
                seed.position.add(seed.velocity.clone().multiplyScalar(delta * 5));

                // Tumbling
                seed.direction.applyAxisAngle(new THREE.Vector3(1, 0, 0), seed.rotationSpeed.x * 0.5);
                seed.direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), seed.rotationSpeed.y);

                // Fade when far from dandelion center
                const dist = seed.position.length();
                seed.opacity = Math.max(0, 1 - Math.max(0, dist - 1.5) * 0.18);
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
            <mesh position={[0, -0.48, 0]}>
                <cylinderGeometry args={[0.012, 0.02, 1.0, 16]} />
                <meshStandardMaterial color="#6a8a4a" roughness={0.75} />
            </mesh>

            <mesh position={[0, 0.015, 0]}>
                <cylinderGeometry args={[0.022, 0.016, 0.025, 16]} />
                <meshStandardMaterial color="#7a9a5a" roughness={0.7} />
            </mesh>

            <group position={[0, -0.005, 0]}>
                {sepals.map((s, i) => (
                    <OrganicSepal key={i} angle={s.angle} lengthMod={s.lengthMod} curveMod={s.curveMod} />
                ))}
            </group>

            <mesh position={[0, 0.015, 0]}>
                <sphereGeometry args={[receptacleRadius, 24, 24]} />
                <meshStandardMaterial color="#c8b060" roughness={0.5} metalness={0.05} />
            </mesh>

            {seeds.map(seed => <DandelionSeed key={seed.id} seed={seed} intensity={currentIntensity} />)}
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

    // Real-time intensity for immediate feedback
    const intensity = blow?.intensity ?? 0;
    const isBlowing = intensity > 0.1;

    // Count remaining seeds
    const [remainingSeeds, setRemainingSeeds] = useState(250);

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
                        {!isConnected ? "Connect phone..." : "Blow to scatter your wish"}
                    </p>
                </div>
                <Link href="/" className="text-gray-400 hover:text-gray-700 text-xs">← back</Link>
            </div>

            {/* Real-time blow intensity indicator */}
            {isConnected && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
                    <div className="flex flex-col items-center gap-2">
                        {/* Intensity bar */}
                        <div className="w-24 h-2 bg-black/10 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-75"
                                style={{ width: `${intensity * 100}%` }}
                            />
                        </div>
                        {/* Animated wind icon */}
                        <div
                            className="text-2xl transition-transform duration-100"
                            style={{
                                transform: isBlowing ? `translateX(${intensity * 8}px) scale(${1 + intensity * 0.2})` : 'none',
                                opacity: isBlowing ? 1 : 0.5
                            }}
                        >
                            {isBlowing ? '💨' : '🌬️'}
                        </div>
                    </div>
                </div>
            )}

            <Canvas camera={{ position: [0, 0.05, 1.3], fov: 45 }}>
                <Suspense fallback={null}><SceneContent /></Suspense>
            </Canvas>
        </div>
    );
}
