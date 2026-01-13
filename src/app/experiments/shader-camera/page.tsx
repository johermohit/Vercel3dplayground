"use client";

import React, { useEffect, useRef, useState, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useConnectionStore } from "@/store/connectionStore";
import { usePeerHost } from "@/hooks/usePeerHost";
import QROverlay from "@/components/QROverlay";
import BackToLobby from "@/components/BackToLobby";
import * as THREE from "three";
import { Environment, Float } from "@react-three/drei";

// Video-textured 3D objects
function VideoShape({
    texture,
    shape,
    wireframe = false
}: {
    texture: THREE.VideoTexture | null,
    shape: 'cube' | 'sphere' | 'torus' | 'cylinder' | 'cone' | 'knot',
    wireframe?: boolean
}) {
    const meshRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        if (meshRef.current) {
            // Gentle rotation
            meshRef.current.rotation.y += 0.005;
            meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.5) * 0.2;
        }
        // Keep video texture updating
        if (texture) {
            texture.needsUpdate = true;
        }
    });

    if (!texture) return null;

    const getGeometry = () => {
        switch (shape) {
            case 'cube':
                return <boxGeometry args={[4, 4, 4]} />;
            case 'sphere':
                return <sphereGeometry args={[2.5, 64, 64]} />;
            case 'torus':
                return <torusGeometry args={[2, 0.8, 32, 100]} />;
            case 'cylinder':
                return <cylinderGeometry args={[2, 2, 4, 64]} />;
            case 'cone':
                return <coneGeometry args={[2, 4, 64]} />;
            case 'knot':
                return <torusKnotGeometry args={[1.5, 0.5, 128, 32]} />;
            default:
                return <sphereGeometry args={[2.5, 64, 64]} />;
        }
    };

    return (
        <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
            <mesh ref={meshRef}>
                {getGeometry()}
                <meshStandardMaterial
                    map={texture}
                    side={THREE.DoubleSide}
                    wireframe={wireframe}
                    metalness={wireframe ? 0.8 : 0.1}
                    roughness={wireframe ? 0.2 : 0.3}
                />
            </mesh>
        </Float>
    );
}

// Scene with lighting
function Scene({
    texture,
    shape,
    wireframe
}: {
    texture: THREE.VideoTexture | null,
    shape: 'cube' | 'sphere' | 'torus' | 'cylinder' | 'cone' | 'knot',
    wireframe: boolean
}) {
    return (
        <>
            <ambientLight intensity={0.3} />
            <spotLight position={[10, 10, 10]} angle={0.3} penumbra={1} intensity={1} />
            <pointLight position={[-10, -10, -10]} intensity={0.5} color="#4488ff" />
            <VideoShape texture={texture} shape={shape} wireframe={wireframe} />
            <Environment preset="night" />
        </>
    );
}

export default function ShaderCameraPage() {
    usePeerHost();
    const { isConnected } = useConnectionStore();

    const [videoTexture, setVideoTexture] = useState<THREE.VideoTexture | null>(null);
    const [currentShape, setCurrentShape] = useState<'cube' | 'sphere' | 'torus' | 'cylinder' | 'cone' | 'knot'>('sphere');
    const [wireframe, setWireframe] = useState(false);
    const [hasStream, setHasStream] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const peerRef = useRef<any>(null);

    // Setup peer connection to receive video call
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

            const peerId = `${sessionId}-video-host`;

            try {
                peer = new Peer(peerId);
                peerRef.current = peer;

                peer.on('open', () => {
                    console.log('[VideoShape] Peer ready:', peerId);
                });

                peer.on('call', (call: any) => {
                    console.log('[VideoShape] Incoming video call!');
                    call.answer();

                    call.on('stream', (remoteStream: MediaStream) => {
                        console.log('[VideoShape] Got remote stream!');
                        if (videoRef.current) {
                            videoRef.current.srcObject = remoteStream;
                            videoRef.current.play().catch(e => console.log('Play error:', e));

                            videoRef.current.onloadeddata = () => {
                                console.log('[VideoShape] Video loaded, creating texture...');
                                const texture = new THREE.VideoTexture(videoRef.current!);
                                texture.minFilter = THREE.LinearFilter;
                                texture.magFilter = THREE.LinearFilter;
                                texture.format = THREE.RGBAFormat;
                                texture.colorSpace = THREE.SRGBColorSpace;
                                setVideoTexture(texture);
                                setHasStream(true);
                            };
                        }
                    });
                });

                peer.on('error', (err: any) => {
                    console.error('[VideoShape] Peer error:', err.type, err.message);
                    if (err.type === 'unavailable-id') {
                        console.log('[VideoShape] ID taken, retrying with unique suffix...');
                        const uniquePeer = new Peer(`${peerId}-${Date.now()}`);
                        peerRef.current = uniquePeer;

                        uniquePeer.on('call', (call: any) => {
                            call.answer();
                            call.on('stream', (remoteStream: MediaStream) => {
                                if (videoRef.current) {
                                    videoRef.current.srcObject = remoteStream;
                                    videoRef.current.play().catch(e => console.log('Play error:', e));
                                    videoRef.current.onloadeddata = () => {
                                        const texture = new THREE.VideoTexture(videoRef.current!);
                                        texture.minFilter = THREE.LinearFilter;
                                        texture.magFilter = THREE.LinearFilter;
                                        setVideoTexture(texture);
                                        setHasStream(true);
                                    };
                                }
                            });
                        });
                    }
                });
            } catch (e) {
                console.error('[VideoShape] Failed to create peer:', e);
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

    const shapes: { key: 'cube' | 'sphere' | 'torus' | 'cylinder' | 'cone' | 'knot', icon: string, name: string }[] = [
        { key: 'cube', icon: '🧊', name: 'CUBE' },
        { key: 'sphere', icon: '🔮', name: 'SPHERE' },
        { key: 'torus', icon: '🍩', name: 'DONUT' },
        { key: 'cylinder', icon: '🥫', name: 'CYLINDER' },
        { key: 'cone', icon: '📐', name: 'CONE' },
        { key: 'knot', icon: '🪢', name: 'KNOT' },
    ];

    return (
        <div className="h-screen w-full bg-gradient-to-b from-gray-950 via-purple-950/20 to-black overflow-hidden">
            <BackToLobby />

            {/* Hidden video element */}
            <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px' }}
            />

            {/* 3D Canvas */}
            <Canvas camera={{ position: [0, 0, 8], fov: 50 }}>
                <Suspense fallback={null}>
                    <Scene texture={videoTexture} shape={currentShape} wireframe={wireframe} />
                </Suspense>
            </Canvas>

            {/* Header */}
            <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                        VIDEO SHAPE
                    </h1>
                    <p className="text-xs text-gray-500 mt-1">
                        Your camera wrapped on 3D objects
                    </p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold ${hasStream
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : isConnected
                        ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                        : 'bg-gray-800 text-gray-500 border border-gray-700'
                    }`}>
                    {hasStream ? '● STREAMING' : isConnected ? '● WAITING' : '○ CONNECT'}
                </div>
            </div>

            {/* Placeholder when no stream */}
            {!hasStream && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                        <div className="text-8xl mb-6 animate-bounce">🔮</div>
                        <h2 className="text-2xl font-bold text-white/60 mb-2">
                            {isConnected ? 'Tap stream on phone!' : 'Connect Your Phone'}
                        </h2>
                        <p className="text-gray-500 text-sm">
                            Your face wrapped around 3D shapes
                        </p>
                    </div>
                </div>
            )}

            {/* Shape selector */}
            <div className="absolute bottom-0 left-0 right-0 p-6">
                <div className="flex flex-col items-center gap-3">
                    {/* Wireframe toggle */}
                    <button
                        onClick={() => setWireframe(!wireframe)}
                        className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${wireframe
                            ? 'bg-white text-black'
                            : 'bg-gray-800/80 text-gray-400 hover:bg-gray-700'
                            }`}
                    >
                        {wireframe ? '◈ WIREFRAME' : '◻ SOLID'}
                    </button>

                    {/* Shape buttons */}
                    <div className="flex flex-wrap justify-center gap-2">
                        {shapes.map(({ key, icon, name }) => (
                            <button
                                key={key}
                                onClick={() => setCurrentShape(key)}
                                className={`px-4 py-3 rounded-xl font-bold text-sm transition-all ${currentShape === key
                                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white scale-105 shadow-lg shadow-purple-500/30'
                                    : 'bg-gray-800/80 text-gray-400 hover:bg-gray-700'
                                    }`}
                            >
                                <span className="text-xl mr-2">{icon}</span>
                                {name}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* QR Overlay */}
            <QROverlay mode="shader" />
        </div>
    );
}
