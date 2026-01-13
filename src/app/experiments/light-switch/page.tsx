"use client";

import React, { useEffect, useRef, useState, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useConnectionStore } from "@/store/connectionStore";
import { usePeerHost } from "@/hooks/usePeerHost";
import QROverlay from "@/components/QROverlay";
import BackToLobby from "@/components/BackToLobby";
import * as THREE from "three";

// Glowing Light Bulb Component
function LightBulb({ brightness }: { brightness: number }) {
    const bulbRef = useRef<THREE.Mesh>(null);
    const glowRef = useRef<THREE.PointLight>(null);

    // Invert brightness - darker room = brighter bulb
    const isOn = brightness < 0.3; // Bulb turns on when it's dark (covered)
    const intensity = isOn ? Math.max(0, (0.3 - brightness) / 0.3) : 0;

    useFrame((state) => {
        if (bulbRef.current && isOn) {
            // Subtle flicker when on
            const flicker = 1 + Math.sin(state.clock.elapsedTime * 20) * 0.02;
            bulbRef.current.scale.setScalar(1 + intensity * 0.1 * flicker);
        }
    });

    return (
        <group position={[0, 0, 0]}>
            {/* Bulb socket/base */}
            <mesh position={[0, -0.8, 0]}>
                <cylinderGeometry args={[0.25, 0.3, 0.4, 32]} />
                <meshStandardMaterial color="#2a2a2a" metalness={0.8} roughness={0.3} />
            </mesh>

            {/* Screw base */}
            <mesh position={[0, -0.5, 0]}>
                <cylinderGeometry args={[0.2, 0.25, 0.3, 32]} />
                <meshStandardMaterial color="#4a4a4a" metalness={0.9} roughness={0.2} />
            </mesh>

            {/* Glass bulb */}
            <mesh ref={bulbRef} position={[0, 0.2, 0]}>
                <sphereGeometry args={[0.5, 32, 32]} />
                <meshStandardMaterial
                    color={isOn ? "#fff5cc" : "#333333"}
                    emissive={isOn ? "#ffdd44" : "#000000"}
                    emissiveIntensity={intensity * 2}
                    transparent
                    opacity={0.9}
                    roughness={0.1}
                />
            </mesh>

            {/* Filament glow */}
            {isOn && (
                <mesh position={[0, 0.2, 0]}>
                    <sphereGeometry args={[0.15, 16, 16]} />
                    <meshBasicMaterial color="#ffaa00" transparent opacity={intensity * 0.8} />
                </mesh>
            )}

            {/* Point light for glow effect */}
            <pointLight
                ref={glowRef}
                position={[0, 0.2, 0]}
                color="#ffdd88"
                intensity={intensity * 8}
                distance={10}
            />
        </group>
    );
}

// Scene with ambient lighting
function Scene({ brightness }: { brightness: number }) {
    return (
        <>
            <ambientLight intensity={0.1} />
            <LightBulb brightness={brightness} />
        </>
    );
}

export default function LightSwitchPage() {
    usePeerHost();
    const { sensorData, isConnected } = useConnectionStore();
    const frameAnalysis = sensorData.frameAnalysis;

    const brightness = frameAnalysis?.brightness ?? 1;
    const isOn = brightness < 0.3;

    return (
        <div className={`min-h-screen transition-colors duration-500 ${isOn
            ? 'bg-gradient-to-b from-amber-900/30 via-gray-900 to-black'
            : 'bg-gradient-to-b from-gray-900 via-gray-950 to-black'
            }`}>
            <BackToLobby />

            {/* Header */}
            <header className="absolute top-0 left-0 right-0 p-6 z-10">
                <div className="max-w-4xl mx-auto flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-white/90">LIGHT SWITCH</h1>
                        <p className="text-xs text-gray-500 mt-1">Cover your phone camera to turn on the light</p>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${isConnected
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-gray-800 text-gray-500 border border-gray-700'
                        }`}>
                        {isConnected ? '● CONNECTED' : '○ WAITING'}
                    </div>
                </div>
            </header>

            {/* 3D Canvas */}
            <div className="h-screen w-full">
                <Canvas camera={{ position: [0, 0, 3], fov: 50 }}>
                    <Suspense fallback={null}>
                        <Scene brightness={brightness} />
                    </Suspense>
                </Canvas>
            </div>

            {/* Status indicator */}
            <div className="absolute bottom-8 left-0 right-0 text-center">
                <div className={`inline-block px-6 py-3 rounded-full backdrop-blur-sm transition-all duration-300 ${isOn
                    ? 'bg-amber-500/20 border border-amber-500/30'
                    : 'bg-gray-800/50 border border-gray-700/50'
                    }`}>
                    <span className={`text-lg font-bold ${isOn ? 'text-amber-300' : 'text-gray-500'}`}>
                        {!isConnected
                            ? '📱 Connect your phone'
                            : isOn
                                ? '💡 LIGHT ON'
                                : '🌙 Cover camera to turn on'
                        }
                    </span>
                    {isConnected && frameAnalysis && (
                        <div className="text-xs text-gray-500 mt-1">
                            Brightness: {Math.round(brightness * 100)}%
                        </div>
                    )}
                </div>
            </div>

            {/* QR Overlay */}
            <QROverlay mode="lightswitch" />
        </div>
    );
}
