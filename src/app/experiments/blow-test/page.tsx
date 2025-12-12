"use client";

import React, { Suspense, useRef, useMemo, useEffect, useState } from "react";
import Link from "next/link";
import { Canvas, useFrame } from "@react-three/fiber";
import { shaderMaterial } from "@react-three/drei";
import * as THREE from "three";
import { usePeerHost } from "@/hooks/usePeerHost";
import { useConnectionStore } from "@/store/connectionStore";
import QROverlay from "@/components/QROverlay";

// Blow-reactive shader (particles disperse when you blow)
const BlowMaterial = shaderMaterial(
    {
        uTime: 0,
        uBlowIntensity: 0,
        uBlowDirection: 0,
    },
    // Vertex
    `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
    `,
    // Fragment - Particles that scatter when blown
    `
    uniform float uTime;
    uniform float uBlowIntensity;
    uniform float uBlowDirection;
    varying vec2 vUv;
    
    float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    
    void main() {
        vec2 uv = vUv;
        float t = uTime;
        
        // Create particles/dust
        vec2 gridUv = uv * 30.0;
        vec2 gridId = floor(gridUv);
        vec2 gridF = fract(gridUv);
        
        // Random offset per particle
        float rand = hash(gridId);
        float rand2 = hash(gridId + 100.0);
        
        // Particle position with blow displacement
        vec2 particlePos = vec2(0.5) + vec2(rand - 0.5, rand2 - 0.5) * 0.3;
        
        // Apply blow force - particles scatter outward
        float blowForce = uBlowIntensity * 2.0;
        vec2 scatterDir = normalize(gridF - 0.5 + 0.001);
        particlePos += scatterDir * blowForce * (0.5 + rand * 0.5);
        
        // Particle wobble
        particlePos.x += sin(t * 2.0 + rand * 6.28) * 0.02 * (1.0 + uBlowIntensity);
        particlePos.y += cos(t * 1.5 + rand2 * 6.28) * 0.02 * (1.0 + uBlowIntensity);
        
        // Draw particle
        float dist = length(gridF - particlePos);
        float particle = smoothstep(0.15, 0.05, dist);
        
        // Particle color - golden dust
        vec3 dustColor = mix(
            vec3(0.9, 0.7, 0.3),
            vec3(1.0, 0.9, 0.6),
            rand
        );
        
        // Fade particles when blown away
        float fade = 1.0 - uBlowIntensity * (0.3 + rand * 0.3);
        particle *= max(0.0, fade);
        
        // Background - dark with subtle gradient
        vec3 bgColor = mix(
            vec3(0.05, 0.05, 0.1),
            vec3(0.1, 0.08, 0.15),
            uv.y
        );
        
        // Add glow when blowing
        vec3 glowColor = vec3(0.3, 0.5, 1.0);
        float glow = uBlowIntensity * 0.3 * (1.0 - length(uv - 0.5));
        bgColor += glowColor * glow;
        
        vec3 finalColor = mix(bgColor, dustColor, particle);
        
        gl_FragColor = vec4(finalColor, 1.0);
    }
    `
);

function BlowScene() {
    const materialRef = useRef<THREE.ShaderMaterial>(null);
    const material = useMemo(() => new BlowMaterial(), []);
    const smoothedIntensity = useRef(0);

    useFrame((state) => {
        if (!materialRef.current) return;

        const { sensorData } = useConnectionStore.getState();
        const blow = sensorData.blow || { intensity: 0, isBlowing: false };

        // Smooth with fast attack, slow release
        const target = blow.intensity;
        if (target > smoothedIntensity.current) {
            smoothedIntensity.current += (target - smoothedIntensity.current) * 0.3;
        } else {
            smoothedIntensity.current += (target - smoothedIntensity.current) * 0.05;
        }

        const mat = materialRef.current as any;
        mat.uTime = state.clock.elapsedTime;
        mat.uBlowIntensity = smoothedIntensity.current;
    });

    return (
        <mesh>
            <planeGeometry args={[16, 12]} />
            <primitive object={material} ref={materialRef} attach="material" />
        </mesh>
    );
}

function SceneContent() {
    usePeerHost();
    return <BlowScene />;
}

export default function BlowTestPage() {
    const { sensorData, isConnected } = useConnectionStore();
    const blow = sensorData.blow;
    const [peakIntensity, setPeakIntensity] = useState(0);
    const [blowCount, setBlowCount] = useState(0);
    const lastBlowRef = useRef(false);

    // Track blow events
    useEffect(() => {
        if (blow?.isBlowing && !lastBlowRef.current) {
            setBlowCount(prev => prev + 1);
            if (blow.intensity > peakIntensity) {
                setPeakIntensity(blow.intensity);
            }
        }
        lastBlowRef.current = blow?.isBlowing || false;
    }, [blow?.isBlowing, blow?.intensity, peakIntensity]);

    return (
        <div className="h-full w-full bg-black text-white overflow-hidden">
            <QROverlay mode="blow" />

            {/* Header */}
            <div className="absolute top-0 left-0 right-0 p-4 z-10 flex justify-between items-start">
                <div className="pointer-events-none">
                    <h1 className="text-2xl font-bold tracking-tight text-cyan-400">08. BLOW</h1>
                    <p className="text-[9px] font-mono text-white/40 mt-0.5">
                        {isConnected ? "BLOW ON YOUR PHONE'S MIC" : "SCAN QR TO CONNECT"}
                    </p>
                </div>
                <Link href="/" className="text-gray-500 hover:text-white text-xs font-mono">← LOBBY</Link>
            </div>

            {/* Stats */}
            {isConnected && (
                <div className="absolute bottom-4 left-4 z-10 pointer-events-none space-y-2">
                    {/* Current intensity */}
                    <div className="flex items-end gap-2">
                        <div className={`text-5xl font-bold tabular-nums transition-colors ${blow?.isBlowing ? 'text-cyan-400' : 'text-white/30'
                            }`}>
                            {Math.round((blow?.intensity || 0) * 100)}
                        </div>
                        <div className="text-sm text-white/40 pb-2">%</div>
                    </div>

                    {/* Blow count */}
                    <div className="text-xs text-white/50 font-mono">
                        BLOWS: {blowCount} · PEAK: {Math.round(peakIntensity * 100)}%
                    </div>

                    {/* Intensity bar */}
                    <div className="w-40 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-75 ${blow?.isBlowing
                                    ? 'bg-gradient-to-r from-cyan-500 to-blue-400'
                                    : 'bg-white/20'
                                }`}
                            style={{ width: `${(blow?.intensity || 0) * 100}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Blowing indicator */}
            {blow?.isBlowing && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
                    <div className="text-6xl animate-pulse">💨</div>
                </div>
            )}

            <Canvas camera={{ position: [0, 0, 5], fov: 60 }}>
                <Suspense fallback={null}>
                    <SceneContent />
                </Suspense>
            </Canvas>
        </div>
    );
}
