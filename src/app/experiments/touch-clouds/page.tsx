"use client";

import React, { Suspense, useRef, useMemo } from "react";
import Link from "next/link";
import { Canvas, useFrame } from "@react-three/fiber";
import { shaderMaterial } from "@react-three/drei";
import * as THREE from "three";
import { usePeerHost } from "@/hooks/usePeerHost";
import { useConnectionStore } from "@/store/connectionStore";
import QROverlay from "@/components/QROverlay";

// Fluffy Cloud Shader - Cotton-like volumetric appearance
const CloudMaterial = shaderMaterial(
    {
        uTime: 0,
        uWandX: 0,
        uWandY: 0,
        uWandZ: 0,
    },
    // Vertex Shader
    `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
    `,
    // Fragment Shader - Fluffy Cotton Clouds
    `
    uniform float uTime;
    uniform float uWandX;
    uniform float uWandY;
    uniform float uWandZ;
    
    varying vec2 vUv;
    
    // Better hash for smoother noise
    vec3 hash33(vec3 p3) {
        p3 = fract(p3 * vec3(.1031, .1030, .0973));
        p3 += dot(p3, p3.yxz + 33.33);
        return fract((p3.xxy + p3.yxx) * p3.zyx);
    }
    
    // 3D Value noise for volumetric feel
    float noise3D(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f); // Smoothstep
        
        float n = i.x + i.y * 157.0 + i.z * 113.0;
        
        vec4 s1 = vec4(
            fract(sin(n) * 43758.5453),
            fract(sin(n + 1.0) * 43758.5453),
            fract(sin(n + 157.0) * 43758.5453),
            fract(sin(n + 158.0) * 43758.5453)
        );
        vec4 s2 = vec4(
            fract(sin(n + 113.0) * 43758.5453),
            fract(sin(n + 114.0) * 43758.5453),
            fract(sin(n + 270.0) * 43758.5453),
            fract(sin(n + 271.0) * 43758.5453)
        );
        
        vec4 m = mix(s1, s2, f.z);
        vec2 m2 = mix(m.xy, m.zw, f.y);
        return mix(m2.x, m2.y, f.x);
    }
    
    // FBM with 3D noise for fluffy effect
    float fbmCloud(vec3 p) {
        float value = 0.0;
        float amplitude = 0.5;
        float frequency = 1.0;
        
        for(int i = 0; i < 6; i++) {
            value += amplitude * noise3D(p * frequency);
            amplitude *= 0.5;
            frequency *= 2.0;
        }
        return value;
    }
    
    // Cloud density function - creates puffy shapes
    float cloudDensity(vec3 p, float t) {
        // Base cloud shape
        float cloud = fbmCloud(p * 2.0 + vec3(t * 0.1, 0.0, t * 0.05));
        
        // Add billowy puffs
        float puffs = fbmCloud(p * 4.0 - vec3(t * 0.2, t * 0.1, 0.0)) * 0.5;
        
        // Combine for cotton-like effect
        cloud = cloud * 0.7 + puffs * 0.3;
        
        // Threshold to create defined edges
        cloud = smoothstep(0.3, 0.7, cloud);
        
        return cloud;
    }
    
    void main() {
        vec2 uv = vUv;
        float t = uTime;
        
        // Wand position affects viewing direction
        vec2 wandOffset = vec2(uWandX, uWandY) * 0.5;
        vec2 shiftedUv = uv - 0.5 + wandOffset;
        
        // Z controls depth/reveal - starts at 1 (full clouds), goes to 0 (revealed)
        float depth = 1.0 - uWandZ; // Invert: push forward = reveal
        
        // Create 3D position for volumetric sampling
        vec3 cloudPos = vec3(shiftedUv * 3.0, depth * 2.0);
        
        // Sample multiple cloud layers for depth
        float layer1 = cloudDensity(cloudPos, t);
        float layer2 = cloudDensity(cloudPos + vec3(0.5, 0.3, 0.8), t * 0.8) * 0.7;
        float layer3 = cloudDensity(cloudPos + vec3(-0.3, 0.7, 1.5), t * 0.6) * 0.5;
        
        // Combine layers with depth-based visibility
        float combinedCloud = layer1 + layer2 * depth + layer3 * depth * depth;
        combinedCloud = clamp(combinedCloud, 0.0, 1.0);
        
        // Apply reveal mask based on distance from center
        float distFromCenter = length(shiftedUv);
        float revealMask = smoothstep(0.0, 0.5 + depth * 0.5, distFromCenter);
        
        // When Z is high (pushed forward), center reveals
        float centerReveal = (1.0 - depth) * (1.0 - smoothstep(0.0, 0.4, distFromCenter));
        combinedCloud *= mix(1.0, revealMask, centerReveal);
        
        // Cloud colors - soft, fluffy white with subtle variation
        vec3 cloudWhite = vec3(0.98, 0.98, 1.0);
        vec3 cloudShadow = vec3(0.7, 0.75, 0.85);
        vec3 cloudHighlight = vec3(1.0, 1.0, 1.0);
        
        // Sky colors
        vec3 skyBlue = vec3(0.4, 0.6, 0.95);
        vec3 skyHorizon = vec3(0.7, 0.85, 1.0);
        vec3 sunGlow = vec3(1.0, 0.95, 0.8);
        
        // Sky gradient
        float skyGradient = uv.y;
        vec3 skyColor = mix(skyHorizon, skyBlue, skyGradient);
        
        // Add sun glow at top center
        float sunDist = length(vec2(uv.x - 0.5, uv.y - 0.8));
        skyColor += sunGlow * 0.3 * smoothstep(0.4, 0.0, sunDist);
        
        // Cloud shading - fake volumetric lighting
        float lighting = 0.5 + 0.5 * noise3D(cloudPos * 5.0 + t * 0.2);
        vec3 cloudColor = mix(cloudShadow, cloudWhite, lighting);
        cloudColor = mix(cloudColor, cloudHighlight, pow(lighting, 3.0) * 0.5);
        
        // Blend cloud with sky
        vec3 finalColor = mix(skyColor, cloudColor, combinedCloud * depth);
        
        // Add golden rim light where clouds meet revealed sky
        float rimLight = centerReveal * combinedCloud * 0.5;
        finalColor += sunGlow * rimLight;
        
        // Subtle vignette
        float vignette = 1.0 - length(uv - 0.5) * 0.3;
        finalColor *= vignette;
        
        gl_FragColor = vec4(finalColor, 1.0);
    }
    `
);

function Clouds() {
    const materialRef = useRef<THREE.ShaderMaterial>(null);
    const material = useMemo(() => new CloudMaterial(), []);

    // Smoothed wand position with spring-back
    const smoothed = useRef({ x: 0, y: 0, z: 0 });

    useFrame((state) => {
        if (!materialRef.current) return;

        // Direct state access
        const { sensorData } = useConnectionStore.getState();
        const wand = sensorData.wand || { x: 0, y: 0, z: 0, calibrated: false };

        // Smooth interpolation (spring-like for responsiveness)
        const lerpFactor = 0.12;
        smoothed.current.x += (wand.x - smoothed.current.x) * lerpFactor;
        smoothed.current.y += (wand.y - smoothed.current.y) * lerpFactor;
        smoothed.current.z += (wand.z - smoothed.current.z) * lerpFactor;

        // Update uniforms
        const mat = materialRef.current as any;
        mat.uTime = state.clock.elapsedTime;
        mat.uWandX = smoothed.current.x;
        mat.uWandY = smoothed.current.y;
        mat.uWandZ = smoothed.current.z;
    });

    return (
        <mesh>
            <planeGeometry args={[14, 14]} />
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
            <color attach="background" args={["#4a6fa5"]} />
            <Clouds />

            {/* Wand indicator - subtle glow sphere */}
            {wand && wand.calibrated && (
                <mesh position={[wand.x * 4, wand.y * 4, 1 + wand.z * 2]}>
                    <sphereGeometry args={[0.08, 16, 16]} />
                    <meshBasicMaterial color="#ffffff" transparent opacity={0.6} />
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
                    <h1 className="text-4xl font-bold tracking-tighter text-white/60">07. TOUCH THE CLOUDS</h1>
                    <p className="text-xs font-mono text-white/40 mt-2">
                        {wand?.calibrated
                            ? "TILT PHONE TO EXPLORE · LEAN FORWARD TO REVEAL SKY"
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
