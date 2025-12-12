"use client";

import React, { Suspense, useState, useRef, useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, Text, Html } from "@react-three/drei";
import { useConnectionStore } from "@/store/connectionStore";
import { usePeerHost } from "@/hooks/usePeerHost";
import * as THREE from "three";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import QROverlay from "@/components/QROverlay";

import { useControls } from "leva";
import { SimplexNoise } from "three/examples/jsm/math/SimplexNoise.js";
import { getClayFrame } from "@/utils/clayMemory";



function ClayMesh() {
    const meshRef = useRef<THREE.Mesh>(null);
    const cursorRef = useRef<THREE.Mesh>(null);
    const debugRef = useRef<HTMLDivElement>(null);

    // Initialize cursor z-pos for visualization- state without re-rendering component
    const targetPos = useRef(new THREE.Vector2(0, 0));

    // Track cursor position in 3D space
    const cursorPos = useRef(new THREE.Vector2(0, 0));

    // Visual Controls
    const { color, roughness, metalness, wireframe, noiseScale } = useControls("Clay Material", {
        color: "#555555",
        roughness: { value: 0.8, min: 0, max: 1 },
        metalness: { value: 0.1, min: 0, max: 1 },
        wireframe: false, // Default off for perf
        noiseScale: { value: 0.2, min: 0, max: 2 }
    });

    // Create a coarse geometry for maximum speed
    // 5x5 size, 30x30 segments (900 verts - very fast)
    const geometry = useMemo(() => new THREE.PlaneGeometry(5, 5, 30, 30), []);

    // Store original positions for reset
    const originalPositions = useRef<Float32Array | null>(null);

    // Initialize original positions on first render
    useEffect(() => {
        if (meshRef.current && !originalPositions.current) {
            const positions = meshRef.current.geometry.attributes.position.array as Float32Array;
            originalPositions.current = new Float32Array(positions);
        }
    }, []);

    // Reset function - exposed to window for button click
    useEffect(() => {
        (window as any).resetClayMesh = () => {
            if (meshRef.current && originalPositions.current) {
                const positions = meshRef.current.geometry.attributes.position;
                for (let i = 0; i < originalPositions.current.length; i++) {
                    (positions.array as Float32Array)[i] = originalPositions.current[i];
                }
                positions.needsUpdate = true;
                meshRef.current.geometry.computeVertexNormals();
                console.log("Mesh Reset!");
            }
        };
    }, []);

    // Frame counter for throttling
    const frameCount = useRef(0);

    useFrame((state, delta) => {
        if (!meshRef.current) return;

        try {
            frameCount.current++;

            // Read input from memory buffer
            const clay = getClayFrame();

            if (clay) {
                // Update Debug HUD directly (Zero React Overhead)
                if (debugRef.current && frameCount.current % 5 === 0) {
                    debugRef.current.innerText = `Frame:${frameCount.current} X:${clay.x?.toFixed(2)} F:${clay.force?.toFixed(2)}`;
                }

                // Map 0..1 (Screen) to -2.5..2.5 (Mesh World)
                // CLAMP to mesh bounds to never go off-mesh
                const MESH_HALF = 2.4; // Slightly inside 2.5 to stay on surface
                let worldX = (clay.x - 0.5) * 5;
                let worldY = -(clay.y - 0.5) * 5;

                // Clamp to bounds
                worldX = Math.max(-MESH_HALF, Math.min(MESH_HALF, worldX));
                worldY = Math.max(-MESH_HALF, Math.min(MESH_HALF, worldY));

                if (Number.isFinite(worldX) && Number.isFinite(worldY)) {
                    targetPos.current.set(worldX, worldY);
                }
            }

            // --- 2. SMOOTHING (LERP) ---
            // Safety Check
            if (!Number.isFinite(cursorPos.current.x) || !Number.isFinite(cursorPos.current.y)) {
                cursorPos.current.set(0, 0);
                targetPos.current.set(0, 0);
            }

            // Fast lerp
            const lerpFactor = 15 * delta;
            cursorPos.current.lerp(targetPos.current, lerpFactor);


            // --- VISUAL CURSOR STATE ---
            const isSculpting = clay && (clay.force || 0) > 0.05;
            if (cursorRef.current) {
                cursorRef.current.position.set(cursorPos.current.x, cursorPos.current.y, 0.1);
                (cursorRef.current.material as THREE.MeshBasicMaterial).color.set(isSculpting ? "#00ff00" : "#ff4444");
            }

            // --- 3. SCULPTING ---
            if (isSculpting && clay) {

                const cx = cursorPos.current.x;
                const cy = cursorPos.current.y;

                const positions = meshRef.current.geometry.attributes.position;
                const count = positions.count;

                let deformed = false;

                // Optimization: Simple distance check
                for (let i = 0; i < count; i++) {
                    const vx = positions.getX(i);
                    const vy = positions.getY(i);
                    const vz = positions.getZ(i);

                    const dx = vx - cx;
                    const dy = vy - cy;
                    // Optimization: avoid sqrt
                    const distSq = dx * dx + dy * dy;

                    const inputRadius = (clay.radius || 20) / 40; // ~0.5
                    const brushSize = Math.max(0.4, inputRadius);
                    const brushSizeSq = brushSize * brushSize;

                    if (distSq < brushSizeSq) {
                        const dist = Math.sqrt(distSq);
                        const falloff = Math.pow(1 - dist / brushSize, 2);
                        const inputForce = Math.max(0.2, clay.force || 0);
                        // BOOSTED FORCE: 50.0 (was 5.0)
                        const pressure = inputForce * 40.0 * delta; // Slightly reduced from 50

                        const targetZ = vz - pressure * falloff;
                        positions.setZ(i, targetZ);
                        deformed = true;
                    }
                }

                if (deformed) {
                    positions.needsUpdate = true;
                    // Throttle normal recompute: Only every 3 frames to save 66% CPU
                    if (frameCount.current % 3 === 0) {
                        meshRef.current.geometry.computeVertexNormals();
                    }
                }
            }

        } catch (err) {
            console.error("Frame Error:", err);
        }
    });

    return (
        <>
            <group position={[0, 0, 0]}>
                {/* Main Clay Mesh */}
                <mesh ref={meshRef} geometry={geometry} rotation={[-Math.PI / 2, 0, 0]}>
                    <meshStandardMaterial
                        color={color}
                        roughness={roughness}
                        metalness={metalness}
                        wireframe={wireframe}
                        side={THREE.DoubleSide}
                    />
                </mesh>

                {/* Boundary Wireframe - Shows sculpting area */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
                    <planeGeometry args={[5, 5]} />
                    <meshBasicMaterial color="#333333" wireframe transparent opacity={0.3} />
                </mesh>

                {/* Visual Cursor */}
                <mesh ref={cursorRef} rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[0.08, 0.12, 32]} />
                    <meshBasicMaterial color="#ff4444" transparent opacity={0.8} />
                </mesh>
            </group>

            {/* Status Overlay */}
            <Html position={[0, 3, 0]} center>
                <div ref={debugRef} className="bg-black/60 text-emerald-400 px-3 py-1 font-mono text-[10px] rounded-full">
                    READY
                </div>
            </Html>
        </>
    );
}


function SceneContent() {
    usePeerHost();
    const { isConnected } = useConnectionStore();

    return (
        <>
            <color attach="background" args={["#111"]} />

            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} intensity={1} />
            <spotLight position={[0, 10, 0]} intensity={0.5} penumbra={1} />

            <ClayMesh />

            {/* Constrained Camera Controls */}
            <OrbitControls
                makeDefault
                minDistance={2}
                maxDistance={20}
                minPolarAngle={0.2}
                maxPolarAngle={Math.PI / 2.2}
                enablePan={false}
            />
            <Environment preset="city" />

            {/* <EffectComposer> */}
            {/* <Bloom luminanceThreshold={0.5} luminanceSmoothing={0.9} height={300} intensity={0.5} /> */}
            {/* </EffectComposer> */}

            {/* Overlay Status */}
            <group position={[0, 4, -5]}>
                <Text
                    color={isConnected ? "#4ade80" : "#ef4444"}
                    fontSize={0.5}
                    anchorX="center"
                    anchorY="middle"
                >
                    {isConnected ? "DEVICE LINKED" : "WAITING FOR SIGNAL..."}
                </Text>
            </group>
        </>
    );
}

export default function DigitalClayPage() {
    return (
        <div className="h-full w-full bg-black text-white">
            <QROverlay mode="clay" />

            {/* Header Overlay */}
            <div className="absolute top-0 left-0 p-8 z-10 flex items-start gap-4">
                <div className="pointer-events-none">
                    <h1 className="text-4xl font-bold tracking-tighter text-white/50">05. DIGITAL CLAY</h1>
                    <p className="text-xs font-mono text-white/30 mt-2">
                        MOVE FINGER TO MOVE CURSOR · PRESS TO SCULPT
                    </p>
                </div>
                <button
                    onClick={() => (window as any).resetClayMesh?.()}
                    className="px-4 py-2 bg-red-600/80 hover:bg-red-500 text-white text-xs font-mono rounded transition-colors pointer-events-auto"
                >
                    RESET MESH
                </button>
            </div>

            <Canvas shadows camera={{ position: [0, 5, 4], fov: 45 }}>
                <Suspense fallback={null}>
                    <SceneContent />
                </Suspense>
            </Canvas>
        </div>
    );
}
