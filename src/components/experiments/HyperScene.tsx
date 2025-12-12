import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, useMemo } from "react";
import * as THREE from "three";
import { OrbitControls, Environment, Float, Stars } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { usePeerHost } from "@/hooks/usePeerHost";
import { useConnectionStore } from "@/store/connectionStore";

function DataCore() {
    const mesh = useRef<THREE.Mesh>(null!);
    const { intensity, color } = useConnectionStore();

    useFrame((state, delta) => {
        // Rotate the core based on intensity "agitation"
        const speed = 0.5 + (intensity * 5);
        mesh.current.rotation.x += delta * speed;
        mesh.current.rotation.y += delta * speed * 0.5;

        // Pulse scale
        const scale = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.1 + (intensity * 0.5);
        mesh.current.scale.setScalar(scale);
    });

    return (
        <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
            <mesh ref={mesh}>
                <icosahedronGeometry args={[2, 0]} />
                <meshStandardMaterial
                    color={color || "#00ff88"}
                    emissive={color || "#00ff88"}
                    emissiveIntensity={1 + (intensity * 4)} // Hyper Glow
                    wireframe={true}
                />
            </mesh>
            {/* Inner Core */}
            <mesh>
                <dodecahedronGeometry args={[1.5, 0]} />
                <meshStandardMaterial color="black" roughness={0.1} metalness={1} />
            </mesh>
        </Float>
    );
}

function Effects() {
    const { intensity } = useConnectionStore();

    return (
        <EffectComposer>
            {/* Cyberpunk Glow - only using Bloom for build stability */}
            <Bloom
                luminanceThreshold={0.1}
                mipmapBlur
                intensity={1.5 + intensity * 2}
                radius={0.8}
            />
        </EffectComposer>
    );
}

export default function HyperScene() {
    usePeerHost();

    return (
        <Canvas camera={{ position: [0, 0, 8], fov: 75 }}>
            <color attach="background" args={["#050505"]} />
            <fog attach="fog" args={["#050505", 5, 20]} />

            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} intensity={1} color="#ff00ff" />
            <pointLight position={[-10, -10, -10]} intensity={1} color="#00ffff" />

            <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
            <DataCore />

            <Effects />
            <OrbitControls autoRotate autoRotateSpeed={0.5} />
            <Environment preset="city" />
        </Canvas>
    );
}
