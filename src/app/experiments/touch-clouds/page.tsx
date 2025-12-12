"use client";

import React, { Suspense, useRef, useMemo } from "react";
import Link from "next/link";
import { Canvas, useFrame } from "@react-three/fiber";
import { shaderMaterial } from "@react-three/drei";
import * as THREE from "three";
import { usePeerHost } from "@/hooks/usePeerHost";
import { useConnectionStore } from "@/store/connectionStore";
import QROverlay from "@/components/QROverlay";

// OPTIMIZED Skydiver Shader - Performance focused
const SkydiverMaterial = shaderMaterial(
    {
        uTime: 0,
        uDepth: 0,
    },
    // Vertex
    `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
    `,
    // Fragment - SIMPLIFIED for performance
    `
    uniform float uTime;
    uniform float uDepth;
    varying vec2 vUv;
    
    // Fast hash
    float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    
    // Simple noise (2 octaves only for speed)
    float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
            mix(hash(i), hash(i + vec2(1,0)), f.x),
            mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x),
            f.y
        );
    }
    
    // Fast FBM (3 octaves max)
    float fbm(vec2 p) {
        return noise(p) * 0.5 + noise(p * 2.0) * 0.3 + noise(p * 4.0) * 0.2;
    }
    
    void main() {
        vec2 uv = vUv;
        float t = uTime * 0.1;
        
        // === DEPTH CONTROLS EVERYTHING ===
        // depth 0 = IN clouds (start here)
        // depth 1 = THROUGH clouds, see earth
        float reveal = uDepth;
        
        // === LAYER 1: GROUND/EARTH (always there, revealed by depth) ===
        // Earth fills bottom 70% of screen
        float groundLevel = 0.7;
        
        // Terrain colors
        vec2 terrainUV = uv * 8.0 + vec2(t * 0.3, t * 0.2);
        float terrain = fbm(terrainUV);
        
        // Patchwork fields
        vec3 green1 = vec3(0.15, 0.35, 0.1);
        vec3 green2 = vec3(0.25, 0.45, 0.15);
        vec3 brown = vec3(0.4, 0.3, 0.15);
        vec3 yellow = vec3(0.55, 0.5, 0.2);
        
        float fieldPattern = noise(terrainUV * 5.0);
        vec3 groundColor = mix(green1, green2, step(0.3, fieldPattern));
        groundColor = mix(groundColor, brown, step(0.6, fieldPattern));
        groundColor = mix(groundColor, yellow, step(0.8, fieldPattern));
        
        // Mountains (darker at high terrain)
        vec3 mountain = vec3(0.3, 0.25, 0.2);
        groundColor = mix(groundColor, mountain, smoothstep(0.5, 0.8, terrain));
        
        // Cities = bright spots
        float city = step(0.93, noise(terrainUV * 20.0));
        groundColor = mix(groundColor, vec3(0.9, 0.85, 0.7), city * 0.7);
        
        // Rivers
        float river = smoothstep(0.48, 0.5, noise(terrainUV * 3.0)) * 
                      smoothstep(0.52, 0.5, noise(terrainUV * 3.0));
        groundColor = mix(groundColor, vec3(0.2, 0.4, 0.6), river);
        
        // === LAYER 2: SKY (top portion) ===
        vec3 skyTop = vec3(0.2, 0.4, 0.7);
        vec3 skyHorizon = vec3(0.6, 0.8, 1.0);
        vec3 skyColor = mix(skyHorizon, skyTop, uv.y);
        
        // Sunset glow on left
        float sunDist = length(vec2(uv.x - 0.1, uv.y - 0.5));
        vec3 sunGlow = vec3(1.0, 0.6, 0.3) * smoothstep(0.5, 0.0, sunDist) * 0.6;
        skyColor += sunGlow;
        
        // Sun disc
        skyColor = mix(skyColor, vec3(1.0, 0.95, 0.85), smoothstep(0.12, 0.08, sunDist));
        
        // === LAYER 3: CLOUDS (interactive) ===
        vec2 cloudUV = uv * 3.0 + vec2(t, t * 0.5);
        float cloud = fbm(cloudUV);
        cloud = smoothstep(0.35, 0.65, cloud);
        
        // Cloud color
        vec3 cloudWhite = vec3(1.0, 0.98, 0.96);
        vec3 cloudShadow = vec3(0.75, 0.8, 0.9);
        float cloudLight = noise(cloudUV * 2.0);
        vec3 cloudColor = mix(cloudShadow, cloudWhite, cloudLight);
        
        // Sunset tint on clouds
        cloudColor += sunGlow * 0.3;
        
        // === COMPOSITE ===
        // Base: sky or ground based on position
        vec3 baseColor = uv.y > groundLevel ? skyColor : groundColor;
        
        // Horizon blend
        float horizonBlend = smoothstep(groundLevel - 0.1, groundLevel + 0.1, uv.y);
        baseColor = mix(groundColor, skyColor, horizonBlend);
        
        // Add atmospheric haze to ground
        float haze = smoothstep(0.0, groundLevel, uv.y) * 0.5;
        baseColor = mix(baseColor, skyHorizon, haze * (1.0 - reveal * 0.5));
        
        // CLOUD LAYER: covers everything based on (1 - depth)
        float cloudCover = cloud * (1.0 - reveal);
        
        // Clouds part from center when pushing through
        float centerDist = length(uv - 0.5);
        float cloudHole = smoothstep(0.0, 0.4 + reveal * 0.3, centerDist);
        cloudCover *= cloudHole;
        
        // Final mix
        vec3 finalColor = mix(baseColor, cloudColor, cloudCover);
        
        // Wind streaks when diving (reveal > 0.3)
        if (reveal > 0.3) {
            float streak = noise(vec2(uv.x * 80.0, uv.y + t * 8.0));
            streak = smoothstep(0.97, 1.0, streak) * reveal;
            finalColor = mix(finalColor, vec3(1.0), streak * 0.15);
        }
        
        // Vignette
        finalColor *= 1.0 - centerDist * 0.25;
        
        gl_FragColor = vec4(finalColor, 1.0);
    }
    `
);

function SkydiverScene() {
    const materialRef = useRef<THREE.ShaderMaterial>(null);
    const material = useMemo(() => new SkydiverMaterial(), []);
    const smoothedDepth = useRef(0);

    useFrame((state) => {
        if (!materialRef.current) return;

        const { sensorData } = useConnectionStore.getState();
        const wand = sensorData.wand || { z: 0, calibrated: false };

        // Faster smoothing for responsiveness
        smoothedDepth.current += (wand.z - smoothedDepth.current) * 0.15;

        const mat = materialRef.current as any;
        mat.uTime = state.clock.elapsedTime;
        mat.uDepth = smoothedDepth.current;
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
    return <SkydiverScene />;
}

export default function TouchCloudsPage() {
    const { sensorData } = useConnectionStore();
    const wand = sensorData.wand;
    const depth = wand?.z || 0;

    const handleReset = () => {
        useConnectionStore.getState().setSensorData({
            wand: { x: 0, y: 0, z: 0, calibrated: false }
        });
    };

    return (
        <div className="h-full w-full bg-black text-white overflow-hidden">
            <QROverlay mode="clouds" />

            {/* Minimal Header */}
            <div className="absolute top-0 left-0 right-0 p-4 z-10 flex justify-between items-start">
                <div className="pointer-events-none">
                    <h1 className="text-2xl font-bold tracking-tight text-white/60">SKYDIVE</h1>
                    <p className="text-[9px] font-mono text-white/30 mt-0.5">
                        {wand?.calibrated ? "TILT FORWARD TO DIVE THROUGH CLOUDS" : "CALIBRATE TO BEGIN"}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleReset}
                        className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white text-[10px] font-mono rounded transition-colors pointer-events-auto"
                    >
                        RESET
                    </button>
                    <Link
                        href="/"
                        className="px-2 py-1 text-white/40 hover:text-white text-[10px] font-mono"
                    >
                        LOBBY
                    </Link>
                </div>
            </div>

            {/* Big Depth Indicator (always visible when calibrated) */}
            {wand?.calibrated && (
                <div className="absolute bottom-4 left-4 z-10 pointer-events-none">
                    <div className="flex items-end gap-2">
                        <div className="text-5xl font-bold text-white/80 tabular-nums">
                            {Math.round(depth * 100)}
                        </div>
                        <div className="text-sm text-white/40 pb-2">%</div>
                    </div>
                    <div className="w-32 h-1.5 bg-white/20 rounded-full overflow-hidden mt-1">
                        <div
                            className="h-full bg-white/80 rounded-full transition-all"
                            style={{ width: `${depth * 100}%` }}
                        />
                    </div>
                    <p className="text-[8px] text-white/30 mt-1 font-mono">CLOUD PENETRATION</p>
                </div>
            )}

            {/* Waiting overlay */}
            {!wand?.calibrated && (
                <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none bg-black/30">
                    <div className="text-center">
                        <div className="text-6xl mb-4">☁️</div>
                        <p className="text-white/60 text-sm font-mono">SCAN QR · CALIBRATE PHONE</p>
                        <p className="text-white/30 text-xs font-mono mt-1">HOLD FLAT · TILT FORWARD TO DIVE</p>
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
