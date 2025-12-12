"use client";

import React, { Suspense, useRef, useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { Canvas, useFrame } from "@react-three/fiber";
import { shaderMaterial } from "@react-three/drei";
import * as THREE from "three";
import { usePeerHost } from "@/hooks/usePeerHost";
import { useConnectionStore } from "@/store/connectionStore";
import QROverlay from "@/components/QROverlay";

// Cloud Shader Material with FBM noise
const CloudMaterial = shaderMaterial(
    {
        uTime: 0,
        uWandX: 0,
        uWandY: 0,
        uWandZ: 0,
        uReveal: 0,
    },
    // Vertex Shader
    `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
    `,
    // Fragment Shader - Layered FBM Clouds
    `
    uniform float uTime;
    uniform float uWandX;
    uniform float uWandY;
    uniform float uWandZ;
    uniform float uReveal;
    
    varying vec2 vUv;
    
    // Hash function
    float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    
    // Value noise
    float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }
    
    // FBM (Fractal Brownian Motion) - realistic cloud density
    float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        float frequency = 1.0;
        
        for(int i = 0; i < 5; i++) {
            value += amplitude * noise(p * frequency);
            amplitude *= 0.5;
            frequency *= 2.0;
        }
        return value;
    }
    
    void main() {
        vec2 uv = vUv;
        float t = uTime * 0.1;
        
        // Apply wand position offset (wiping effect)
        vec2 center = vec2(0.5 + uWandX * 0.3, 0.5 + uWandY * 0.3);
        
        // Distance from wand position (for reveal effect)
        float distFromWand = length(uv - center);
        
        // Z controls reveal intensity
        float reveal = uWandZ * 1.5;
        
        // Create layered clouds with different speeds
        float cloud1 = fbm(uv * 3.0 + t + vec2(uWandX * 0.5, uWandY * 0.5));
        float cloud2 = fbm(uv * 5.0 - t * 0.7 + vec2(-uWandX * 0.3, uWandY * 0.3));
        float cloud3 = fbm(uv * 8.0 + t * 0.3);
        
        // Combine layers with depth
        float cloudDensity = cloud1 * 0.5 + cloud2 * 0.3 + cloud3 * 0.2;
        
        // Apply reveal based on Z (pushing through clouds)
        // The closer Z is to 1, the more the clouds part
        float revealMask = smoothstep(reveal * 0.5, reveal * 0.8, distFromWand);
        cloudDensity *= revealMask;
        
        // Wipe effect - X/Y movement clears smoke
        float wipeFactor = 1.0 - smoothstep(0.0, 0.4, length(vec2(uWandX, uWandY)));
        cloudDensity *= mix(1.0, wipeFactor, 0.5);
        
        // Cloud color gradient (white to light blue sky)
        vec3 cloudColor = vec3(0.9, 0.92, 0.95);
        vec3 skyColor = vec3(0.4, 0.6, 0.9);
        vec3 deepSkyColor = vec3(0.1, 0.3, 0.7);
        
        // Mix based on density and reveal
        vec3 finalColor = mix(skyColor, cloudColor, cloudDensity);
        
        // At high reveal (Z pushed forward), show deep sky behind
        float skyReveal = smoothstep(0.3, 0.8, reveal) * (1.0 - revealMask);
        finalColor = mix(finalColor, deepSkyColor, skyReveal);
        
        // Add subtle golden light where clouds part
        float lightBeam = (1.0 - distFromWand) * reveal * 0.5;
        finalColor += vec3(1.0, 0.9, 0.7) * lightBeam * 0.3;
        
        // Vignette for depth
        float vignette = 1.0 - length(uv - 0.5) * 0.5;
        finalColor *= vignette;
        
        gl_FragColor = vec4(finalColor, 1.0);
    }
    `
);

function Clouds() {
    const materialRef = useRef<THREE.ShaderMaterial>(null);
    const material = useMemo(() => new CloudMaterial(), []);

    // Smoothed wand position
    const smoothed = useRef({ x: 0, y: 0, z: 0 });

    useFrame((state) => {
        if (!materialRef.current) return;

        // Direct state access
        const { sensorData } = useConnectionStore.getState();
        const wand = sensorData.wand || { x: 0, y: 0, z: 0, calibrated: false };

        // Smooth interpolation
        const lerpFactor = 0.08;
        smoothed.current.x += (wand.x - smoothed.current.x) * lerpFactor;
        smoothed.current.y += (wand.y - smoothed.current.y) * lerpFactor;
        smoothed.current.z += (wand.z - smoothed.current.z) * lerpFactor;

        // Update uniforms
        const mat = materialRef.current as any;
        mat.uTime = state.clock.elapsedTime;
        mat.uWandX = smoothed.current.x;
        mat.uWandY = smoothed.current.y;
        mat.uWandZ = smoothed.current.z;
        mat.uReveal = smoothed.current.z;
    });

    return (
        <mesh>
            <planeGeometry args={[12, 12]} />
            <primitive object={material} ref={materialRef} attach="material" />
        </mesh>
    );
}

function SceneContent() {
    usePeerHost();
    const { isConnected, sensorData } = useConnectionStore();
    const wand = sensorData.wand;

    return (
        <>
            <color attach="background" args={["#1a2a4a"]} />
            <Clouds />

            {/* Wand indicator sphere */}
            {wand && wand.calibrated && (
                <mesh position={[wand.x * 3, wand.y * 3, wand.z * 2]}>
                    <sphereGeometry args={[0.1, 16, 16]} />
                    <meshBasicMaterial color="#ffffff" transparent opacity={0.5} />
                </mesh>
            )}
        </>
    );
}

export default function TouchCloudsPage() {
    const { sensorData } = useConnectionStore();
    const wand = sensorData.wand;

    const handleReset = () => {
        useConnectionStore.getState().setSensorData({
            wand: { x: 0, y: 0, z: 0, calibrated: false }
        });
    };

    return (
        <div className="h-full w-full bg-black text-white">
            <QROverlay mode="clouds" />

            {/* Header Overlay */}
            <div className="absolute top-0 left-0 p-8 z-10 flex items-start gap-4">
                <div className="pointer-events-none">
                    <h1 className="text-4xl font-bold tracking-tighter text-white/50">07. TOUCH THE CLOUDS</h1>
                    <p className="text-xs font-mono text-white/30 mt-2">
                        {wand?.calibrated
                            ? "MOVE PHONE TO PART THE CLOUDS · PUSH FORWARD TO REVEAL"
                            : "CONNECT PHONE · CALIBRATE · EXPLORE"
                        }
                    </p>
                </div>
                <button
                    onClick={handleReset}
                    className="px-4 py-2 bg-blue-600/80 hover:bg-blue-500 text-white text-xs font-mono rounded transition-colors pointer-events-auto"
                >
                    RESET
                </button>
            </div>

            {/* Back Button */}
            <Link
                href="/"
                className="absolute top-8 right-8 z-20 text-white/50 hover:text-white text-sm font-mono"
            >
                ← LOBBY
            </Link>

            {/* Calibration Status */}
            {!wand?.calibrated && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                    <div className="bg-black/70 border border-white/20 px-6 py-3 rounded-full">
                        <p className="text-white/70 font-mono text-sm">
                            AWAITING CALIBRATION...
                        </p>
                    </div>
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
