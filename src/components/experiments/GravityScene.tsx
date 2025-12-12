import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, useMemo, useState } from "react";
import * as THREE from "three";
import { Environment, OrbitControls } from "@react-three/drei";
import { usePeerHost } from "@/hooks/usePeerHost";
import { useConnectionStore } from "@/store/connectionStore";

const COUNT = 1000;

function Particles() {
    const mesh = useRef<THREE.InstancedMesh>(null!);
    const { rotation, color } = useConnectionStore();

    // Physics State
    const particles = useMemo(() => {
        const temp = [];
        for (let i = 0; i < COUNT; i++) {
            const t = Math.random() * 100;
            const factor = 20 + Math.random() * 100;
            const speed = 0.01 + Math.random() / 200;
            const x = Math.random() * 100 - 50;
            const y = Math.random() * 100 - 50;
            const z = Math.random() * 100 - 50;

            temp.push({ t, factor, speed, x, y, z, mx: 0, my: 0 });
        }
        return temp;
    }, []);

    const dummy = useMemo(() => new THREE.Object3D(), []);

    useFrame((state) => {
        // "Rotation" from phone is now mapped to Cursor Position
        // X: -180 to 180 (Rotation) -> Mapped to -50 to 50
        // Y: -90 to 90 (Rotation) -> Mapped to -50 to 50
        // But since we are using Touch Delta (x, y), it's just relative movement.
        // We need a persistent cursor position.

        // Let's assume the "rotation" state in store is actually accumulating X/Y delta
        // So rotation.x is effectively Cursor X.

        const cursorX = rotation.x / 5; // Scale down
        const cursorY = rotation.y / 5;

        particles.forEach((particle, i) => {
            // physics calculation
            // Simple: Move towards cursor
            // particle.mx += (cursorX - particle.x) * 0.001;
            // particle.my += (cursorY - particle.y) * 0.001;

            // particle.x += particle.mx;
            // particle.y += particle.my;

            // Let's do a Swirl
            const t = particle.t = particle.t += particle.speed / 2;
            const a = Math.cos(t) + Math.sin(t * 1) / 10;
            const b = Math.sin(t) + Math.cos(t * 2) / 10;
            const s = Math.cos(t);

            // Apply Phone Influence
            // Distort based on distance to cursor
            const dist = Math.sqrt(Math.pow(particle.x - cursorX, 2) + Math.pow(particle.y - cursorY, 2));
            const force = Math.max(0, (20 - dist) / 2); // Radius of 20

            // Update Instance Matrix
            dummy.position.set(
                particle.x + Math.cos(t) + (particle.x - cursorX) * force * 0.1,
                particle.y + Math.sin(t) + (particle.y - cursorY) * force * 0.1,
                particle.z
            );
            dummy.scale.set(s, s, s);
            dummy.rotation.set(s * 5, s * 5, s * 5);
            dummy.updateMatrix();

            mesh.current.setMatrixAt(i, dummy.matrix);
        });
        mesh.current.instanceMatrix.needsUpdate = true;
    });

    return (
        <instancedMesh ref={mesh} args={[undefined, undefined, COUNT]}>
            <dodecahedronGeometry args={[0.2, 0]} />
            <meshStandardMaterial color={color || "white"} />
        </instancedMesh>
    );
}

export default function GravityScene() {
    usePeerHost();

    return (
        <Canvas camera={{ position: [0, 0, 30], fov: 75 }}>
            <color attach="background" args={["#111"]} />
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} intensity={1} />
            <Particles />
            {/* <OrbitControls /> Disable Orbit to focus on Phone Control */}
            <Environment preset="night" />
        </Canvas>
    );
}
