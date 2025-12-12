"use client";

import React, { Suspense, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, shaderMaterial } from "@react-three/drei";
import * as THREE from "three";
import { usePeerHost } from "@/hooks/usePeerHost";
import { useConnectionStore } from "@/store/connectionStore";
import QROverlay from "@/components/QROverlay";

// Custom Shader Material for Aura Field
const AuraFieldMaterial = shaderMaterial(
    // Uniforms
    {
        uTime: 0,
        uAlpha: 0,
        uBeta: 0,
        uGamma: 0,
        uShake: 0,
        uTouchForce: 0,
        uResolution: new THREE.Vector2(1, 1),
    },
    // Vertex Shader
    `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
    `,
    // Fragment Shader
    `
    uniform float uTime;
    uniform float uAlpha;
    uniform float uBeta;
    uniform float uGamma;
    uniform float uShake;
    uniform float uTouchForce;
    uniform vec2 uResolution;
    
    varying vec2 vUv;
    
    // Simplex noise function
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
    
    float snoise(vec2 v) {
        const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy));
        vec2 x0 = v -   i + dot(i, C.xx);
        vec2 i1;
        i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289(i);
        vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m*m;
        m = m*m;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
        vec3 g;
        g.x  = a0.x  * x0.x  + h.x  * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
    }
    
    void main() {
        vec2 uv = vUv;
        
        // Time-based animation
        float t = uTime * 0.3;
        
        // Apply orientation-based distortion
        float alphaInfluence = uAlpha * 0.5;
        float betaInfluence = uBeta * 0.3;
        float gammaInfluence = uGamma * 0.3;
        
        // Warp UV based on orientation
        uv.x += sin(uv.y * 3.0 + t + alphaInfluence) * 0.05 * (1.0 + uShake);
        uv.y += cos(uv.x * 3.0 + t + betaInfluence) * 0.05 * (1.0 + uShake);
        
        // Multi-layered noise
        float noise1 = snoise(uv * 3.0 + t * 0.5);
        float noise2 = snoise(uv * 6.0 - t * 0.3 + vec2(gammaInfluence, alphaInfluence));
        float noise3 = snoise(uv * 12.0 + t * 0.2);
        
        // Combine noise layers with shake intensity
        float combined = noise1 * 0.5 + noise2 * 0.3 + noise3 * 0.2;
        combined = combined * 0.5 + 0.5; // Normalize to 0-1
        combined += uShake * 0.3 * noise3; // Shake adds turbulence
        
        // Hue based on orientation alpha (0-1 maps to color wheel)
        float hue = fract(alphaInfluence + combined * 0.3 + t * 0.1);
        
        // HSL to RGB conversion
        vec3 rgb;
        float h = hue * 6.0;
        float c = 0.7; // Saturation
        float x = c * (1.0 - abs(mod(h, 2.0) - 1.0));
        if (h < 1.0) rgb = vec3(c, x, 0.0);
        else if (h < 2.0) rgb = vec3(x, c, 0.0);
        else if (h < 3.0) rgb = vec3(0.0, c, x);
        else if (h < 4.0) rgb = vec3(0.0, x, c);
        else if (h < 5.0) rgb = vec3(x, 0.0, c);
        else rgb = vec3(c, 0.0, x);
        
        // Add intensity from touch force
        float glow = uTouchForce * 0.8;
        rgb += glow;
        
        // Radial pulse effect from touch
        float dist = length(uv - 0.5);
        float pulse = sin(dist * 20.0 - uTime * 5.0 - uTouchForce * 10.0) * 0.5 + 0.5;
        rgb += pulse * uTouchForce * 0.3;
        
        // Vignette
        float vignette = 1.0 - dist * 0.8;
        rgb *= vignette;
        
        // Final brightness adjustment
        rgb = rgb * (0.6 + combined * 0.5);
        
        gl_FragColor = vec4(rgb, 1.0);
    }
    `
);

// AuraFieldMaterial is used directly with primitive element

function AuraField() {
    const materialRef = useRef<THREE.ShaderMaterial>(null);
    const frameCount = useRef(0);

    // Create material instance with useMemo
    const material = useMemo(() => new AuraFieldMaterial(), []);

    // Smoothed values for interpolation
    const smoothed = useRef({
        alpha: 0,
        beta: 0,
        gamma: 0,
        shake: 0,
        touchForce: 0,
    });

    useFrame((state) => {
        if (!materialRef.current) return;

        frameCount.current++;

        // Direct state access (no re-renders)
        const { sensorData } = useConnectionStore.getState();

        // Extract sensor values with defaults
        const orientation = sensorData.orientation || { alpha: 0, beta: 0, gamma: 0 };
        const acceleration = sensorData.acceleration || { x: 0, y: 0, z: 0 };
        const touch = sensorData.touch || { force: 0, radius: 0 };

        // Normalize values
        const targetAlpha = (orientation.alpha || 0) / 360; // 0-1
        const targetBeta = ((orientation.beta || 0) + 180) / 360; // 0-1
        const targetGamma = ((orientation.gamma || 0) + 90) / 180; // 0-1

        // Calculate shake from acceleration magnitude
        const accMag = Math.sqrt(
            Math.pow(acceleration.x || 0, 2) +
            Math.pow(acceleration.y || 0, 2) +
            Math.pow(acceleration.z || 0, 2)
        );
        const targetShake = Math.min(1, Math.max(0, (accMag - 9.8) / 20)); // Subtract gravity, normalize

        const targetTouchForce = touch.force || 0;

        // Smooth interpolation (lerp)
        const lerpFactor = 0.1;
        smoothed.current.alpha += (targetAlpha - smoothed.current.alpha) * lerpFactor;
        smoothed.current.beta += (targetBeta - smoothed.current.beta) * lerpFactor;
        smoothed.current.gamma += (targetGamma - smoothed.current.gamma) * lerpFactor;
        smoothed.current.shake += (targetShake - smoothed.current.shake) * lerpFactor;
        smoothed.current.touchForce += (targetTouchForce - smoothed.current.touchForce) * 0.2;

        // Update shader uniforms
        const mat = materialRef.current as any;
        mat.uTime = state.clock.elapsedTime;
        mat.uAlpha = smoothed.current.alpha;
        mat.uBeta = smoothed.current.beta;
        mat.uGamma = smoothed.current.gamma;
        mat.uShake = smoothed.current.shake;
        mat.uTouchForce = smoothed.current.touchForce;
    });

    return (
        <mesh rotation={[0, 0, 0]}>
            <planeGeometry args={[10, 10]} />
            <primitive object={material} ref={materialRef} attach="material" />
        </mesh>
    );
}

function SceneContent() {
    usePeerHost();
    const { isConnected } = useConnectionStore();

    return (
        <>
            <color attach="background" args={["#000"]} />
            <AuraField />

            {/* Connection Status */}
            <group position={[0, 4, 0]}>
                <mesh>
                    <sphereGeometry args={[0.1, 16, 16]} />
                    <meshBasicMaterial color={isConnected ? "#00ff88" : "#ff4444"} />
                </mesh>
            </group>
        </>
    );
}

export default function AuraFieldPage() {
    return (
        <div className="h-full w-full bg-black text-white">
            <QROverlay mode="sensor" />

            {/* Header Overlay */}
            <div className="absolute top-0 left-0 p-8 z-10 pointer-events-none">
                <h1 className="text-4xl font-bold tracking-tighter text-white/50">06. AURA FIELD</h1>
                <p className="text-xs font-mono text-white/30 mt-2">
                    TILT PHONE TO MORPH · SHAKE TO DISTORT · TOUCH TO PULSE
                </p>
            </div>

            {/* Back Button */}
            <Link
                href="/"
                className="absolute top-8 right-8 z-20 text-white/50 hover:text-white text-sm font-mono"
            >
                ← LOBBY
            </Link>

            <Canvas camera={{ position: [0, 0, 5], fov: 60 }}>
                <Suspense fallback={null}>
                    <SceneContent />
                </Suspense>
            </Canvas>
        </div>
    );
}
