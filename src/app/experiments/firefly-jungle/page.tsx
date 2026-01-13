"use client";

import React, { useRef, useMemo, Suspense, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useConnectionStore } from "@/store/connectionStore";
import { usePeerHost } from "@/hooks/usePeerHost";
import QROverlay from "@/components/QROverlay";
import BackToLobby from "@/components/BackToLobby";
import * as THREE from "three";

// Grass blade component - instanced for performance
function GrassField() {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const count = 2000;

    const { matrices, colors } = useMemo(() => {
        const matrices: THREE.Matrix4[] = [];
        const colors: THREE.Color[] = [];
        const tempMatrix = new THREE.Matrix4();
        const tempPosition = new THREE.Vector3();
        const tempRotation = new THREE.Euler();
        const tempQuaternion = new THREE.Quaternion();
        const tempScale = new THREE.Vector3();

        for (let i = 0; i < count; i++) {
            // Random position in a field
            const x = (Math.random() - 0.5) * 20;
            const z = (Math.random() - 0.5) * 15;
            tempPosition.set(x, 0, z);

            // Random rotation (slight lean)
            tempRotation.set(
                (Math.random() - 0.5) * 0.3,
                Math.random() * Math.PI * 2,
                (Math.random() - 0.5) * 0.3
            );
            tempQuaternion.setFromEuler(tempRotation);

            // Random height
            const height = 0.3 + Math.random() * 0.5;
            tempScale.set(0.02, height, 0.02);

            tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
            matrices.push(tempMatrix.clone());

            // Varying green shades
            const greenVariation = 0.15 + Math.random() * 0.2;
            colors.push(new THREE.Color(0.02, greenVariation, 0.03));
        }

        return { matrices, colors };
    }, []);

    useEffect(() => {
        if (!meshRef.current) return;

        matrices.forEach((matrix, i) => {
            meshRef.current!.setMatrixAt(i, matrix);
            meshRef.current!.setColorAt(i, colors[i]);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
        if (meshRef.current.instanceColor) {
            meshRef.current.instanceColor.needsUpdate = true;
        }
    }, [matrices, colors]);

    // Gentle wind sway
    useFrame((state) => {
        if (!meshRef.current) return;
        const time = state.clock.elapsedTime;

        for (let i = 0; i < count; i++) {
            const matrix = matrices[i].clone();
            const windOffset = Math.sin(time * 0.5 + i * 0.01) * 0.05;

            // Extract position and add wind
            const pos = new THREE.Vector3();
            pos.setFromMatrixPosition(matrix);

            const windMatrix = new THREE.Matrix4();
            windMatrix.makeRotationZ(windOffset);
            matrix.multiply(windMatrix);

            meshRef.current!.setMatrixAt(i, matrix);
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
    });

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
            <coneGeometry args={[1, 1, 4, 1]} />
            <meshStandardMaterial
                vertexColors
                roughness={0.8}
            />
        </instancedMesh>
    );
}

// Single detailed firefly with point light
function Firefly({ position, intensity, index }: {
    position: [number, number, number],
    intensity: number,
    index: number
}) {
    const groupRef = useRef<THREE.Group>(null);
    const lightRef = useRef<THREE.PointLight>(null);
    const [blinkPhase] = useState(() => Math.random() * Math.PI * 2);
    const [blinkSpeed] = useState(() => 1 + Math.random() * 2);
    const [floatOffset] = useState(() => Math.random() * Math.PI * 2);

    useFrame((state) => {
        if (!groupRef.current || !lightRef.current) return;

        const time = state.clock.elapsedTime;

        // Blink pattern - organic on/off
        const blink = Math.sin(time * blinkSpeed + blinkPhase);
        const blinkIntensity = blink > 0.3 ? Math.pow((blink - 0.3) / 0.7, 2) : 0;

        // Apply intensity
        const finalIntensity = blinkIntensity * intensity;
        lightRef.current.intensity = finalIntensity * 3;

        // Gentle floating motion
        groupRef.current.position.y = position[1] + Math.sin(time * 0.8 + floatOffset) * 0.15;
        groupRef.current.position.x = position[0] + Math.sin(time * 0.5 + floatOffset * 2) * 0.1;
    });

    return (
        <group ref={groupRef} position={position}>
            {/* Firefly body - tiny but visible */}
            <mesh>
                <sphereGeometry args={[0.02, 8, 8]} />
                <meshBasicMaterial color="#1a1a0a" />
            </mesh>

            {/* Glowing abdomen */}
            <mesh position={[0, -0.01, 0]}>
                <sphereGeometry args={[0.025, 8, 8]} />
                <meshBasicMaterial
                    color="#ffffaa"
                    transparent
                    opacity={intensity}
                />
            </mesh>

            {/* Outer glow */}
            <mesh position={[0, -0.01, 0]}>
                <sphereGeometry args={[0.06, 8, 8]} />
                <meshBasicMaterial
                    color="#88ff44"
                    transparent
                    opacity={intensity * 0.3}
                />
            </mesh>

            {/* Point light that illuminates grass */}
            <pointLight
                ref={lightRef}
                color="#aaffaa"
                intensity={0}
                distance={1.5}
                decay={2}
            />
        </group>
    );
}

// Fireflies container
function Fireflies({ intensity }: { intensity: number }) {
    const fireflyPositions = useMemo(() => {
        const positions: [number, number, number][] = [];
        const count = 15; // Fewer but more detailed

        for (let i = 0; i < count; i++) {
            positions.push([
                (Math.random() - 0.5) * 8,
                0.3 + Math.random() * 0.6, // Low, just above grass
                (Math.random() - 0.5) * 6 - 1
            ]);
        }

        return positions;
    }, []);

    return (
        <group>
            {fireflyPositions.map((pos, i) => (
                <Firefly
                    key={i}
                    position={pos}
                    intensity={intensity}
                    index={i}
                />
            ))}
        </group>
    );
}

// Ground plane
function Ground() {
    return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
            <planeGeometry args={[30, 30]} />
            <meshStandardMaterial
                color="#0a0a05"
                roughness={1}
            />
        </mesh>
    );
}

// Main scene - minimal
function GrassScene({ intensity }: { intensity: number }) {
    return (
        <>
            {/* Very dim ambient - night time */}
            <ambientLight intensity={0.02} color="#1a1a2a" />

            {/* Slight moonlight from above */}
            <directionalLight
                position={[5, 10, 5]}
                intensity={0.03 + intensity * 0.02}
                color="#aabbcc"
            />

            <Ground />
            <GrassField />
            <Fireflies intensity={intensity} />

            {/* Subtle fog for depth */}
            <fog attach="fog" args={['#020203', 5, 20]} />
        </>
    );
}

export default function FireflyJunglePage() {
    usePeerHost();
    const { sensorData, isConnected } = useConnectionStore();
    const frameAnalysis = sensorData.frameAnalysis;

    const brightness = frameAnalysis?.brightness ?? 1;

    // Hysteresis: activate at <30%, deactivate at >80%
    const [isActive, setIsActive] = useState(false);

    useEffect(() => {
        if (brightness < 0.3 && !isActive) {
            setIsActive(true);
        } else if (brightness > 0.8 && isActive) {
            setIsActive(false);
        }
    }, [brightness, isActive]);

    // Smooth intensity transition
    const [displayIntensity, setDisplayIntensity] = useState(0);

    useEffect(() => {
        const target = isActive ? 1 : 0;
        const interval = setInterval(() => {
            setDisplayIntensity(prev => {
                const diff = target - prev;
                if (Math.abs(diff) < 0.01) return target;
                return prev + diff * 0.03; // Slow fade
            });
        }, 16);
        return () => clearInterval(interval);
    }, [isActive]);

    return (
        <div className="h-screen w-full bg-[#010102] overflow-hidden">
            <BackToLobby variant="icon" />

            {/* 3D Canvas - low angle camera */}
            <Canvas
                camera={{
                    position: [0, 0.4, 4],
                    fov: 45,
                    near: 0.1,
                    far: 50
                }}
                gl={{ antialias: true }}
            >
                <Suspense fallback={null}>
                    <GrassScene intensity={displayIntensity} />
                </Suspense>
            </Canvas>

            {/* Minimal UI */}
            <div className="absolute top-6 left-6 pointer-events-none">
                <h1 className="text-lg font-light text-emerald-200/50 tracking-widest">
                    FIREFLIES
                </h1>
            </div>

            {/* Connection indicator */}
            <div className="absolute top-6 right-6">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-gray-600'
                    }`} />
            </div>

            {/* Bottom hint */}
            <div className="absolute bottom-6 left-0 right-0 text-center pointer-events-none">
                <p className={`text-xs tracking-widest transition-all duration-1000 ${isActive ? 'text-emerald-300/60' : 'text-gray-600'
                    }`}>
                    {!isConnected
                        ? 'connect phone'
                        : isActive
                            ? '· · ·'
                            : 'cover camera'
                    }
                </p>
            </div>

            {/* QR Overlay */}
            <QROverlay mode="lightswitch" />
        </div>
    );
}
