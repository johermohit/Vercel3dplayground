import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import { Mesh, MathUtils } from "three";
import { Environment, OrbitControls } from "@react-three/drei";
import { usePeerHost } from "@/hooks/usePeerHost";
import { useConnectionStore } from "@/store/connectionStore";

function Box(props: any) {
    const mesh = useRef<Mesh>(null!);
    const [hovered, setHover] = useState(false);
    const [active, setActive] = useState(false);
    const rotation = useConnectionStore((state) => state.rotation);
    const activeColor = useConnectionStore((state) => state.color);

    // Smoothly interpolate rotation
    useFrame((state, delta) => {
        const targetX = MathUtils.degToRad(rotation.x);
        const targetY = MathUtils.degToRad(rotation.y);

        // Lerp current rotation to target
        mesh.current.rotation.x = MathUtils.lerp(mesh.current.rotation.x, targetX, 0.1);
        mesh.current.rotation.y = MathUtils.lerp(mesh.current.rotation.y, targetY, 0.1);
    });

    return (
        <mesh
            {...props}
            ref={mesh}
            scale={active ? 1.5 : 1}
            onClick={(event) => setActive(!active)}
            onPointerOver={(event) => setHover(true)}
            onPointerOut={(event) => setHover(false)}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={activeColor || "orange"} />
        </mesh>
    );
}

export default function Scene() {
    usePeerHost(); // Initialize Host Logic

    return (
        <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
            <color attach="background" args={["#000000"]} />
            <ambientLight intensity={0.5} />
            <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} decay={0} intensity={Math.PI} />
            <pointLight position={[-10, -10, -10]} decay={0} intensity={Math.PI} />
            {/* Single controllable box now */}
            <Box position={[0, 0, 0]} />
            <OrbitControls />
            <Environment preset="city" />
        </Canvas>
    );
}
