"use client";

import React, { Suspense, useRef, useMemo } from "react";
import Link from "next/link";
import { Canvas, useFrame } from "@react-three/fiber";
import { shaderMaterial } from "@react-three/drei";
import * as THREE from "three";
import { usePeerHost } from "@/hooks/usePeerHost";
import { useConnectionStore } from "@/store/connectionStore";
import QROverlay from "@/components/QROverlay";

// Skydiver Scene Shader - Layered with depth
const SkydiverMaterial = shaderMaterial(
    {
        uTime: 0,
        uDepth: 0, // 0 = in clouds, 1 = through clouds, seeing earth
    },
    // Vertex Shader
    `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
    `,
    // Fragment Shader - Skydiver POV
    `
    uniform float uTime;
    uniform float uDepth;
    
    varying vec2 vUv;
    
    // Hash functions
    float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    
    float hash3(vec3 p) {
        return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
    }
    
    // 2D noise
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
    
    // 3D noise for volumetric clouds
    float noise3D(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        
        float n = hash3(i) * (1.0 - f.x) * (1.0 - f.y) * (1.0 - f.z)
                + hash3(i + vec3(1,0,0)) * f.x * (1.0 - f.y) * (1.0 - f.z)
                + hash3(i + vec3(0,1,0)) * (1.0 - f.x) * f.y * (1.0 - f.z)
                + hash3(i + vec3(1,1,0)) * f.x * f.y * (1.0 - f.z)
                + hash3(i + vec3(0,0,1)) * (1.0 - f.x) * (1.0 - f.y) * f.z
                + hash3(i + vec3(1,0,1)) * f.x * (1.0 - f.y) * f.z
                + hash3(i + vec3(0,1,1)) * (1.0 - f.x) * f.y * f.z
                + hash3(i + vec3(1,1,1)) * f.x * f.y * f.z;
        return n;
    }
    
    // FBM for clouds
    float fbm(vec3 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for(int i = 0; i < 5; i++) {
            value += amplitude * noise3D(p);
            amplitude *= 0.5;
            p *= 2.0;
        }
        return value;
    }
    
    // FBM for terrain
    float fbmTerrain(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for(int i = 0; i < 6; i++) {
            value += amplitude * noise(p);
            amplitude *= 0.5;
            p *= 2.0;
        }
        return value;
    }
    
    void main() {
        vec2 uv = vUv;
        float t = uTime * 0.05;
        
        // === LAYER 1: SKY GRADIENT + SUNSET ===
        // Horizon at bottom, sky at top
        float horizon = 0.25; // Where earth meets sky
        
        // Sky gradient (top to horizon)
        vec3 skyTop = vec3(0.15, 0.35, 0.65);    // Deep blue
        vec3 skyHorizon = vec3(0.5, 0.7, 0.9);   // Light blue at horizon
        
        // Sunset colors (on left side)
        vec3 sunsetOrange = vec3(1.0, 0.5, 0.2);
        vec3 sunsetPink = vec3(1.0, 0.6, 0.7);
        vec3 sunsetPurple = vec3(0.6, 0.3, 0.5);
        
        // Sunset position and influence
        float sunsetX = 0.15; // Left side
        float sunDist = length(vec2(uv.x - sunsetX, (uv.y - horizon) * 2.0));
        float sunGlow = smoothstep(0.6, 0.0, sunDist);
        
        // Mix sky with sunset
        vec3 skyColor = mix(skyTop, skyHorizon, smoothstep(1.0, horizon, uv.y));
        skyColor = mix(skyColor, sunsetOrange, sunGlow * 0.8);
        skyColor = mix(skyColor, sunsetPink, sunGlow * 0.4 * smoothstep(0.3, 0.0, sunDist));
        
        // Sun disc
        float sunDisc = smoothstep(0.08, 0.05, sunDist);
        skyColor = mix(skyColor, vec3(1.0, 0.95, 0.8), sunDisc);
        
        // === LAYER 2: EARTH/TERRAIN (below horizon) ===
        // Only visible when depth > 0 (pushed through clouds)
        
        vec3 terrainColor = vec3(0.0);
        if (uv.y < horizon + 0.1) {
            // Terrain perspective (looking down as skydiver)
            vec2 terrainUV = vec2(uv.x, (horizon - uv.y) * 5.0 + t * 0.5);
            
            // Base terrain noise (mountains, valleys)
            float terrainHeight = fbmTerrain(terrainUV * 8.0);
            
            // Patchwork fields (green/brown/yellow)
            float fields = noise(terrainUV * 30.0);
            vec3 fieldGreen = vec3(0.2, 0.4, 0.15);
            vec3 fieldYellow = vec3(0.5, 0.45, 0.2);
            vec3 fieldBrown = vec3(0.35, 0.25, 0.15);
            
            vec3 fieldColor = mix(fieldGreen, fieldYellow, step(0.5, fields));
            fieldColor = mix(fieldColor, fieldBrown, step(0.75, fields));
            
            // Mountains (grayish at high terrain)
            vec3 mountainColor = vec3(0.4, 0.38, 0.35);
            terrainColor = mix(fieldColor, mountainColor, smoothstep(0.5, 0.8, terrainHeight));
            
            // Add some "city" dots (scattered bright spots)
            float cityNoise = noise(terrainUV * 100.0);
            float cityMask = step(0.92, cityNoise) * step(0.7, 1.0 - terrainHeight);
            terrainColor = mix(terrainColor, vec3(0.9, 0.85, 0.7), cityMask * 0.6);
            
            // Rivers (blue lines)
            float riverNoise = noise(terrainUV * 15.0 + vec2(100.0, 0.0));
            float river = smoothstep(0.48, 0.5, riverNoise) * smoothstep(0.52, 0.5, riverNoise);
            terrainColor = mix(terrainColor, vec3(0.2, 0.4, 0.6), river * 0.8);
            
            // Atmospheric haze (distance fog)
            float distanceFog = smoothstep(0.0, horizon, uv.y);
            terrainColor = mix(terrainColor, skyHorizon * 0.8, distanceFog * 0.7);
        }
        
        // === LAYER 3: CLOUDS (interactive layer) ===
        // Cloud density based on depth - more clouds when depth is low
        float cloudLayer = 1.0 - uDepth; // Invert: depth 0 = full clouds, depth 1 = no clouds
        
        // Moving clouds
        vec3 cloudPos = vec3(uv * 4.0, t);
        float cloud = fbm(cloudPos);
        float cloud2 = fbm(cloudPos + vec3(1.5, 0.5, t * 0.3));
        
        // Combine cloud layers
        float cloudDensity = (cloud * 0.6 + cloud2 * 0.4);
        cloudDensity = smoothstep(0.3, 0.7, cloudDensity);
        
        // Clouds are fluffy white with subtle blue shadows
        vec3 cloudWhite = vec3(1.0, 0.99, 0.98);
        vec3 cloudShadow = vec3(0.7, 0.75, 0.85);
        float cloudLighting = noise3D(cloudPos * 2.0 + vec3(0, 0, t * 0.5));
        vec3 cloudColor = mix(cloudShadow, cloudWhite, cloudLighting);
        
        // Sunset reflection on clouds
        cloudColor = mix(cloudColor, sunsetOrange * 0.5 + vec3(0.5), sunGlow * 0.3);
        
        // === COMPOSITE ALL LAYERS ===
        vec3 finalColor = skyColor;
        
        // Add terrain (visible based on depth and position)
        float terrainVisibility = smoothstep(horizon + 0.1, horizon - 0.1, uv.y) * uDepth;
        finalColor = mix(finalColor, terrainColor, terrainVisibility);
        
        // Add clouds on top (less clouds = more terrain visible)
        float cloudVisibility = cloudDensity * cloudLayer;
        
        // Clouds dissolve from center when pushing forward
        float centerDist = length(uv - 0.5);
        float cloudHole = smoothstep(0.0, 0.5, centerDist * (1.0 + uDepth));
        cloudVisibility *= mix(cloudHole, 1.0, 1.0 - uDepth);
        
        finalColor = mix(finalColor, cloudColor, cloudVisibility);
        
        // Add slight vignette
        float vignette = 1.0 - centerDist * 0.3;
        finalColor *= vignette;
        
        // Wind streaks for motion feel (subtle)
        float windStreak = noise(vec2(uv.x * 100.0, uv.y + t * 10.0));
        windStreak = smoothstep(0.98, 1.0, windStreak);
        finalColor = mix(finalColor, vec3(1.0), windStreak * 0.1 * uDepth);
        
        gl_FragColor = vec4(finalColor, 1.0);
    }
    `
);

function SkydiverScene() {
    const materialRef = useRef<THREE.ShaderMaterial>(null);
    const material = useMemo(() => new SkydiverMaterial(), []);

    // Smoothed depth
    const smoothedDepth = useRef(0);

    useFrame((state) => {
        if (!materialRef.current) return;

        // Direct state access
        const { sensorData } = useConnectionStore.getState();
        const wand = sensorData.wand || { x: 0, y: 0, z: 0, calibrated: false };

        // Smooth depth interpolation
        const targetDepth = wand.z;
        smoothedDepth.current += (targetDepth - smoothedDepth.current) * 0.08;

        // Update uniforms
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
    const { sensorData } = useConnectionStore();
    const wand = sensorData.wand;

    return (
        <>
            <SkydiverScene />
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
        <div className="h-full w-full bg-black text-white overflow-hidden">
            <QROverlay mode="clouds" />

            {/* Header Overlay */}
            <div className="absolute top-0 left-0 p-6 z-10 flex items-start gap-4">
                <div className="pointer-events-none">
                    <h1 className="text-3xl font-bold tracking-tighter text-white/70">07. SKYDIVE</h1>
                    <p className="text-[10px] font-mono text-white/40 mt-1">
                        {wand?.calibrated
                            ? `DEPTH: ${(wand.z * 100).toFixed(0)}% · TILT FORWARD TO DESCEND`
                            : "CONNECT PHONE · CALIBRATE · DIVE"
                        }
                    </p>
                </div>
                <button
                    onClick={handleReset}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-mono rounded transition-colors pointer-events-auto border border-white/20"
                >
                    RESET
                </button>
            </div>

            {/* Back Button */}
            <Link
                href="/"
                className="absolute top-6 right-6 z-20 text-white/40 hover:text-white text-xs font-mono"
            >
                ← LOBBY
            </Link>

            {/* Depth Indicator */}
            {wand?.calibrated && (
                <div className="absolute right-6 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                    <div className="h-48 w-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                            className="w-full bg-gradient-to-t from-green-400 to-blue-400 transition-all duration-150 rounded-full"
                            style={{ height: `${wand.z * 100}%` }}
                        />
                    </div>
                    <p className="text-[8px] text-white/40 text-center mt-1 font-mono">DEPTH</p>
                </div>
            )}

            {/* Calibration Status */}
            {!wand?.calibrated && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                    <div className="bg-black/70 border border-white/10 px-5 py-2 rounded-full backdrop-blur-sm">
                        <p className="text-white/60 font-mono text-xs">
                            WAITING FOR CALIBRATION...
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
