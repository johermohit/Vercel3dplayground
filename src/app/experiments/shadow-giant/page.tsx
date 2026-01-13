"use client";

import React, { useEffect, useRef, useState, Suspense, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useConnectionStore } from "@/store/connectionStore";
import { usePeerHost } from "@/hooks/usePeerHost";
import QROverlay from "@/components/QROverlay";
import BackToLobby from "@/components/BackToLobby";
import * as THREE from "three";

// Little creatures that run from the shadow
function Creature({ startPosition }: { startPosition: [number, number, number] }) {
    const meshRef = useRef<THREE.Mesh>(null);
    const velocity = useRef({ x: 0, z: 0 });
    const [hue] = useState(() => Math.random());

    useFrame(() => {
        if (!meshRef.current) return;

        // Random wandering
        velocity.current.x += (Math.random() - 0.5) * 0.002;
        velocity.current.z += (Math.random() - 0.5) * 0.002;

        // Damping
        velocity.current.x *= 0.98;
        velocity.current.z *= 0.98;

        // Apply velocity
        meshRef.current.position.x += velocity.current.x;
        meshRef.current.position.z += velocity.current.z;

        // Boundary
        const limit = 8;
        if (Math.abs(meshRef.current.position.x) > limit) velocity.current.x *= -1;
        if (Math.abs(meshRef.current.position.z) > limit) velocity.current.z *= -1;

        // Bounce animation
        meshRef.current.position.y = 0.15 + Math.sin(Date.now() * 0.01 + startPosition[0]) * 0.05;

        // Face movement direction
        if (Math.abs(velocity.current.x) > 0.001 || Math.abs(velocity.current.z) > 0.001) {
            meshRef.current.rotation.y = Math.atan2(velocity.current.x, velocity.current.z);
        }
    });

    return (
        <mesh ref={meshRef} position={startPosition}>
            <coneGeometry args={[0.1, 0.3, 8]} />
            <meshStandardMaterial
                color={`hsl(${hue * 360}, 70%, 60%)`}
                emissive={`hsl(${hue * 360}, 70%, 30%)`}
                emissiveIntensity={0.3}
            />
        </mesh>
    );
}

// Ground plane
function Ground() {
    return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
            <planeGeometry args={[20, 20]} />
            <meshStandardMaterial color="#2a4a3a" />
        </mesh>
    );
}

// Shadow overlay from video silhouette
function ShadowOverlay({ texture }: { texture: THREE.Texture | null }) {
    const meshRef = useRef<THREE.Mesh>(null);

    if (!texture) return null;

    return (
        <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
            <planeGeometry args={[16, 12]} />
            <meshBasicMaterial
                map={texture}
                transparent
                opacity={0.7}
                blending={THREE.MultiplyBlending}
                premultipliedAlpha
            />
        </mesh>
    );
}

// Main scene
function Scene({ shadowTexture }: { shadowTexture: THREE.Texture | null }) {
    // Generate creature positions
    const creatures = useMemo(() => {
        return Array.from({ length: 30 }, () => ({
            position: [
                (Math.random() - 0.5) * 14,
                0.15,
                (Math.random() - 0.5) * 10
            ] as [number, number, number]
        }));
    }, []);

    return (
        <>
            {/* Lighting */}
            <ambientLight intensity={0.4} />
            <directionalLight
                position={[5, 10, 5]}
                intensity={1}
                castShadow
            />
            <pointLight position={[-5, 5, -5]} intensity={0.3} color="#88aaff" />

            {/* Ground */}
            <Ground />

            {/* Shadow overlay */}
            <ShadowOverlay texture={shadowTexture} />

            {/* Creatures */}
            {creatures.map((c, i) => (
                <Creature key={i} startPosition={c.position} />
            ))}

            {/* Some decorative elements */}
            {Array.from({ length: 20 }).map((_, i) => (
                <mesh
                    key={`tree-${i}`}
                    position={[
                        (Math.random() - 0.5) * 18,
                        0.3,
                        (Math.random() - 0.5) * 14
                    ]}
                >
                    <cylinderGeometry args={[0.05, 0.1, 0.6, 8]} />
                    <meshStandardMaterial color="#3a2a1a" />
                </mesh>
            ))}
        </>
    );
}

export default function ShadowSilhouettePage() {
    usePeerHost();
    const { isConnected } = useConnectionStore();

    const [shadowTexture, setShadowTexture] = useState<THREE.Texture | null>(null);
    const [hasStream, setHasStream] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const peerRef = useRef<any>(null);
    const animationRef = useRef<number>(0);

    // Process video to create silhouette
    useEffect(() => {
        if (!hasStream || !videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Create texture once
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        setShadowTexture(texture);

        const processFrame = () => {
            if (video.readyState >= video.HAVE_CURRENT_DATA) {
                // Set canvas size
                canvas.width = 256;
                canvas.height = 192;

                // Draw video frame (mirrored for front camera)
                ctx.save();
                ctx.scale(-1, 1);
                ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
                ctx.restore();

                // Get image data
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;

                // Convert to silhouette (threshold based)
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];

                    // Calculate brightness
                    const brightness = (r + g + b) / 3;

                    // Threshold - darker areas become shadow
                    if (brightness < 120) {
                        // Dark shadow
                        data[i] = 0;      // R
                        data[i + 1] = 0;  // G
                        data[i + 2] = 0;  // B
                        data[i + 3] = 200; // A - semi transparent
                    } else {
                        // Transparent
                        data[i + 3] = 0;
                    }
                }

                ctx.putImageData(imageData, 0, 0);

                // Update texture
                texture.needsUpdate = true;
            }

            animationRef.current = requestAnimationFrame(processFrame);
        };

        processFrame();

        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [hasStream]);

    // Setup peer connection to receive video
    useEffect(() => {
        let peer: any = null;

        const setupPeer = async () => {
            const { Peer } = await import('peerjs');
            const sessionId = useConnectionStore.getState().sessionId;

            if (!sessionId) return;

            // Destroy existing peer if any
            if (peerRef.current) {
                peerRef.current.destroy();
                peerRef.current = null;
            }

            // Create peer with unique ID (add random suffix to avoid collisions)
            const peerId = `${sessionId}-video-host`;

            try {
                peer = new Peer(peerId);
                peerRef.current = peer;

                peer.on('open', () => {
                    console.log('[Shadow] Peer ready:', peerId);
                });

                peer.on('call', (call: any) => {
                    console.log('[Shadow] Incoming video call!');
                    call.answer();

                    call.on('stream', (remoteStream: MediaStream) => {
                        console.log('[Shadow] Got remote stream!');
                        if (videoRef.current) {
                            videoRef.current.srcObject = remoteStream;
                            videoRef.current.play().catch(e => console.log('Play error:', e));

                            videoRef.current.onloadeddata = () => {
                                setHasStream(true);
                            };
                        }
                    });
                });

                peer.on('error', (err: any) => {
                    console.error('[Shadow] Peer error:', err.type, err.message);
                    // If ID is taken, retry with a unique suffix
                    if (err.type === 'unavailable-id') {
                        console.log('[Shadow] ID taken, retrying with unique suffix...');
                        const uniquePeer = new Peer(`${peerId}-${Date.now()}`);
                        peerRef.current = uniquePeer;

                        uniquePeer.on('call', (call: any) => {
                            call.answer();
                            call.on('stream', (remoteStream: MediaStream) => {
                                if (videoRef.current) {
                                    videoRef.current.srcObject = remoteStream;
                                    videoRef.current.play().catch(e => console.log('Play error:', e));
                                    videoRef.current.onloadeddata = () => setHasStream(true);
                                }
                            });
                        });
                    }
                });
            } catch (e) {
                console.error('[Shadow] Failed to create peer:', e);
            }
        };

        setupPeer();

        return () => {
            if (peerRef.current) {
                peerRef.current.destroy();
                peerRef.current = null;
            }
        };
    }, []);

    return (
        <div className="h-screen w-full bg-gradient-to-b from-gray-900 via-emerald-950/30 to-black overflow-hidden">
            <BackToLobby />

            {/* Hidden video and canvas */}
            <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                style={{ position: 'absolute', left: '-9999px' }}
            />
            <canvas
                ref={canvasRef}
                style={{ position: 'absolute', left: '-9999px' }}
            />

            {/* 3D Canvas */}
            <Canvas
                camera={{ position: [0, 12, 8], fov: 50 }}
                shadows
            >
                <Suspense fallback={null}>
                    <Scene shadowTexture={shadowTexture} />
                </Suspense>
            </Canvas>

            {/* Header */}
            <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start pointer-events-none">
                <div>
                    <h1 className="text-3xl font-bold text-white/80">SHADOW GIANT</h1>
                    <p className="text-xs text-gray-500 mt-1">
                        Your silhouette looms over a tiny world
                    </p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold ${hasStream
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : isConnected
                        ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                        : 'bg-gray-800 text-gray-500 border border-gray-700'
                    }`}>
                    {hasStream ? '● SHADOW ACTIVE' : isConnected ? '● WAITING' : '○ CONNECT'}
                </div>
            </div>

            {/* Instructions */}
            {!hasStream && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                        <div className="text-8xl mb-6">👤</div>
                        <h2 className="text-2xl font-bold text-white/60 mb-2">
                            {isConnected ? 'Start streaming!' : 'Connect Phone'}
                        </h2>
                        <p className="text-gray-500 text-sm max-w-md">
                            Point front camera at yourself. Your shadow will loom over tiny creatures!
                        </p>
                    </div>
                </div>
            )}

            {/* Hint when active */}
            {hasStream && (
                <div className="absolute bottom-6 left-0 right-0 text-center pointer-events-none">
                    <p className="text-emerald-400/60 text-sm">
                        Move your head • Wave your hand • Watch your shadow
                    </p>
                </div>
            )}

            {/* QR Overlay */}
            <QROverlay mode="shader" />
        </div>
    );
}
