"use client";

import React, { useRef, Suspense, useState, useEffect, useCallback, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, OrbitControls, Environment, Center } from "@react-three/drei";
import { useConnectionStore } from "@/store/connectionStore";
import { usePeerHost } from "@/hooks/usePeerHost";
import BackToLobby from "@/components/BackToLobby";
import * as THREE from "three";

// Types
interface NodeInfo {
    name: string;
    type: string;
    path: string;
    depth: number;
    object: THREE.Object3D;
    children: NodeInfo[];
    tag?: string; // User-assigned tag
}

interface ModelStats {
    totalNodes: number;
    meshCount: number;
    boneCount: number;
    groupCount: number;
    objectCount: number;
    animationCount: number;
    hasArmature: boolean;
}

// Build hierarchy tree from scene
function buildHierarchy(obj: THREE.Object3D, path: string = "", depth: number = 0): NodeInfo {
    const currentPath = path ? `${path}.${obj.name}` : obj.name;
    return {
        name: obj.name || "(unnamed)",
        type: obj.type,
        path: currentPath,
        depth,
        object: obj,
        children: obj.children.map(child => buildHierarchy(child, currentPath, depth + 1))
    };
}

// Flatten hierarchy for display
function flattenHierarchy(node: NodeInfo): NodeInfo[] {
    return [node, ...node.children.flatMap(child => flattenHierarchy(child))];
}

// Dynamic Model Viewer Component
function ModelViewer({
    modelUrl,
    selectedNode,
    onNodeSelect,
    onHierarchyLoaded,
    onStatsLoaded,
    jointControls,
}: {
    modelUrl: string | null;
    selectedNode: string | null;
    onNodeSelect: (node: NodeInfo | null) => void;
    onHierarchyLoaded: (nodes: NodeInfo[]) => void;
    onStatsLoaded: (stats: ModelStats) => void;
    jointControls: Record<string, number>;
}) {
    const groupRef = useRef<THREE.Group>(null);
    const { camera, raycaster, pointer } = useThree();
    const hierarchyLoadedRef = useRef(false);

    const { scene: gltfScene, animations } = useGLTF(modelUrl || "/assets/excavator.glb");
    const clonedScene = useMemo(() => gltfScene.clone(), [gltfScene]);

    // Build and report hierarchy on load
    useEffect(() => {
        if (clonedScene && !hierarchyLoadedRef.current) {
            const hierarchy = buildHierarchy(clonedScene);
            const flat = flattenHierarchy(hierarchy);
            onHierarchyLoaded(flat);

            // Calculate stats
            const stats: ModelStats = {
                totalNodes: flat.length,
                meshCount: flat.filter(n => n.type === "Mesh" || n.type === "SkinnedMesh").length,
                boneCount: flat.filter(n => n.type === "Bone").length,
                groupCount: flat.filter(n => n.type === "Group").length,
                objectCount: flat.filter(n => n.type === "Object3D").length,
                animationCount: animations?.length || 0,
                hasArmature: flat.some(n => n.name === "Armature" || n.type === "Bone")
            };
            onStatsLoaded(stats);
            hierarchyLoadedRef.current = true;
        }
    }, [clonedScene, animations, onHierarchyLoaded, onStatsLoaded]);

    useEffect(() => {
        hierarchyLoadedRef.current = false;
    }, [modelUrl]);

    // Apply joint controls - NOW WORKS FOR BONES TOO
    useFrame(() => {
        if (!groupRef.current) return;

        Object.entries(jointControls).forEach(([path, value]) => {
            const parts = path.split('.');
            const nodeName = parts[0];
            const property = parts[1];
            const axis = parts[2] as 'x' | 'y' | 'z';

            // Search in cloned scene (works for bones too)
            let node = clonedScene.getObjectByName(nodeName);
            if (node && property === 'rotation') {
                node.rotation[axis] = value;
            }
        });
    });

    const handleClick = useCallback(() => {
        if (!groupRef.current) return;
        raycaster.setFromCamera(pointer, camera);
        const intersects = raycaster.intersectObjects(groupRef.current.children, true);
        if (intersects.length > 0) {
            const hit = intersects[0].object;
            const hierarchy = buildHierarchy(clonedScene);
            const flat = flattenHierarchy(hierarchy);
            const found = flat.find(n => n.object === hit || n.name === hit.name);
            if (found) onNodeSelect(found);
        }
    }, [camera, pointer, raycaster, clonedScene, onNodeSelect]);

    return (
        <group ref={groupRef} onClick={handleClick}>
            <Center>
                <primitive object={clonedScene} scale={1} />
            </Center>
        </group>
    );
}

// Get icon for node type
function getNodeIcon(type: string): string {
    switch (type) {
        case "Bone": return "🦴";
        case "Mesh": return "🟢";
        case "SkinnedMesh": return "🧬";
        case "Group": return "📁";
        case "Object3D": return "⬜";
        case "Scene": return "🌍";
        default: return "○";
    }
}

// Hierarchy Panel Component with icons and filtering
function HierarchyPanel({
    nodes,
    selectedNode,
    onSelect,
    filter,
    tags,
    onTagChange
}: {
    nodes: NodeInfo[];
    selectedNode: string | null;
    onSelect: (node: NodeInfo) => void;
    filter: string;
    tags: Record<string, string>;
    onTagChange: (nodeName: string, tag: string) => void;
}) {
    const filteredNodes = useMemo(() => {
        if (filter === "all") return nodes;
        if (filter === "bones") return nodes.filter(n => n.type === "Bone");
        if (filter === "meshes") return nodes.filter(n => n.type === "Mesh" || n.type === "SkinnedMesh");
        if (filter === "objects") return nodes.filter(n => n.type === "Object3D" || n.type === "Group");
        if (filter === "tagged") return nodes.filter(n => tags[n.name]);
        return nodes;
    }, [nodes, filter, tags]);

    return (
        <div className="flex flex-col gap-0.5 text-xs font-mono">
            {filteredNodes.map((node, i) => {
                const tag = tags[node.name];
                return (
                    <div
                        key={i}
                        onClick={() => onSelect(node)}
                        className={`px-2 py-1 cursor-pointer rounded transition-all group ${selectedNode === node.path
                            ? "bg-amber-500/30 text-amber-300 border-l-2 border-amber-500"
                            : "hover:bg-white/5 text-gray-400"
                            }`}
                        style={{ paddingLeft: `${node.depth * 10 + 6}px` }}
                    >
                        <span className="mr-1">{getNodeIcon(node.type)}</span>
                        <span className={tag ? "text-cyan-400" : "text-white"}>{tag || node.name}</span>
                        {tag && <span className="text-gray-600 ml-1 text-[10px]">({node.name})</span>}
                    </div>
                );
            })}
        </div>
    );
}

// Stats Panel
function StatsPanel({ stats }: { stats: ModelStats | null }) {
    if (!stats) return null;
    return (
        <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-zinc-800 rounded p-2">
                <div className="text-lg font-bold text-white">{stats.meshCount}</div>
                <div className="text-[9px] text-zinc-500">MESHES</div>
            </div>
            <div className="bg-zinc-800 rounded p-2">
                <div className="text-lg font-bold text-amber-400">{stats.boneCount}</div>
                <div className="text-[9px] text-zinc-500">BONES</div>
            </div>
            <div className="bg-zinc-800 rounded p-2">
                <div className="text-lg font-bold text-blue-400">{stats.animationCount}</div>
                <div className="text-[9px] text-zinc-500">ANIMS</div>
            </div>
        </div>
    );
}

// Joint Slider Component
function JointSlider({
    label, value, min, max, onChange
}: {
    label: string; value: number; min: number; max: number; onChange: (v: number) => void;
}) {
    return (
        <div className="flex items-center gap-2 text-xs">
            <span className="w-12 text-gray-400">{label}</span>
            <input
                type="range"
                min={min}
                max={max}
                step={0.01}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className="flex-1 h-2 bg-zinc-800 rounded appearance-none cursor-pointer accent-amber-500"
            />
            <span className="w-12 text-right font-mono text-gray-500">{value.toFixed(2)}</span>
        </div>
    );
}

useGLTF.preload("/assets/excavator.glb");

export default function GLBWorkshopPage() {
    usePeerHost();
    const { isConnected } = useConnectionStore();

    const [modelUrl, setModelUrl] = useState<string | null>(null);
    const [modelName, setModelName] = useState("excavator.glb");
    const [hierarchy, setHierarchy] = useState<NodeInfo[]>([]);
    const [selectedNode, setSelectedNode] = useState<NodeInfo | null>(null);
    const [jointControls, setJointControls] = useState<Record<string, number>>({});
    const [isDragging, setIsDragging] = useState(false);
    const [stats, setStats] = useState<ModelStats | null>(null);
    const [filter, setFilter] = useState("all");
    const [tags, setTags] = useState<Record<string, string>>({});
    const [editingTag, setEditingTag] = useState(false);
    const [tagInput, setTagInput] = useState("");

    // Load tags from localStorage
    useEffect(() => {
        const saved = localStorage.getItem(`glb-tags-${modelName}`);
        if (saved) setTags(JSON.parse(saved));
    }, [modelName]);

    // Save tags to localStorage
    const saveTags = useCallback((newTags: Record<string, string>) => {
        setTags(newTags);
        localStorage.setItem(`glb-tags-${modelName}`, JSON.stringify(newTags));
    }, [modelName]);

    // Handle file drop
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith('.glb')) {
            setModelUrl(URL.createObjectURL(file));
            setModelName(file.name);
            setSelectedNode(null);
            setJointControls({});
            setStats(null);
        }
    }, []);

    // Handle node selection
    const handleNodeSelect = useCallback((node: NodeInfo | null) => {
        setSelectedNode(node);
        setEditingTag(false);
        if (node) {
            setTagInput(tags[node.name] || "");
            // Add rotation controls
            setJointControls(prev => ({
                ...prev,
                [`${node.name}.rotation.x`]: node.object.rotation.x,
                [`${node.name}.rotation.y`]: node.object.rotation.y,
                [`${node.name}.rotation.z`]: node.object.rotation.z,
            }));
        }
    }, [tags]);

    // Save tag for current node
    const saveTag = useCallback(() => {
        if (selectedNode && tagInput.trim()) {
            saveTags({ ...tags, [selectedNode.name]: tagInput.trim() });
        }
        setEditingTag(false);
    }, [selectedNode, tagInput, tags, saveTags]);

    // Generate comprehensive export
    const exportModelInfo = useCallback(() => {
        const bones = hierarchy.filter(n => n.type === "Bone");
        const meshes = hierarchy.filter(n => n.type === "Mesh" || n.type === "SkinnedMesh");

        let code = `// ═══════════════════════════════════════════════════════════════
// GLB MODEL EXPORT: ${modelName}
// Generated by GLB Workshop
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────
// MODEL STATS
// ─────────────────────────────────────────────────────────────────
// Total Nodes: ${stats?.totalNodes || 0}
// Meshes: ${stats?.meshCount || 0}
// Bones: ${stats?.boneCount || 0}
// Animations: ${stats?.animationCount || 0}
// Has Armature: ${stats?.hasArmature ? "YES" : "NO"}

`;

        // Tags section
        if (Object.keys(tags).length > 0) {
            code += `// ─────────────────────────────────────────────────────────────────
// YOUR TAGS (semantic names you assigned)
// ─────────────────────────────────────────────────────────────────
const TAGS = ${JSON.stringify(tags, null, 2)};

`;
        }

        // Bones section
        if (bones.length > 0) {
            code += `// ─────────────────────────────────────────────────────────────────
// BONES (for animation - rotate these!)
// ─────────────────────────────────────────────────────────────────
const getBones = (scene) => ({
${bones.map(b => {
                const tag = tags[b.name];
                return `    ${tag || b.name}: scene.getObjectByName("${b.name}"),${tag ? ` // Tagged: "${tag}"` : ""}`;
            }).join('\n')}
});

// Example bone rotation:
// bones.Bone001.rotation.x = 0.5;

`;
        }

        // Meshes section
        code += `// ─────────────────────────────────────────────────────────────────
// MESHES (visual geometry)
// ─────────────────────────────────────────────────────────────────
const getMeshes = (scene) => ({
${meshes.slice(0, 20).map(m => {
            const tag = tags[m.name];
            return `    ${(tag || m.name).replace(/[^a-zA-Z0-9]/g, '_')}: scene.getObjectByName("${m.name}"),${tag ? ` // Tagged: "${tag}"` : ""}`;
        }).join('\n')}${meshes.length > 20 ? `\n    // ... and ${meshes.length - 20} more meshes` : ""}
});

`;

        // Current rotation state
        if (Object.keys(jointControls).length > 0) {
            code += `// ─────────────────────────────────────────────────────────────────
// CURRENT ROTATION VALUES (from your workshop testing)
// ─────────────────────────────────────────────────────────────────
const SAVED_ROTATIONS = {
${Object.entries(jointControls).map(([key, val]) =>
                `    "${key}": ${val.toFixed(4)},`
            ).join('\n')}
};

// Apply saved rotations:
// Object.entries(SAVED_ROTATIONS).forEach(([path, value]) => {
//     const [name, prop, axis] = path.split('.');
//     const node = scene.getObjectByName(name);
//     if (node) node[prop][axis] = value;
// });

`;
        }

        // Phone controller template
        code += `// ─────────────────────────────────────────────────────────────────
// PHONE CONTROLLER TEMPLATE
// ─────────────────────────────────────────────────────────────────
interface ${modelName.replace('.glb', '').replace(/[^a-zA-Z]/g, '')}Controls {
${bones.length > 0 ? bones.slice(0, 5).map(b => {
            const tag = tags[b.name] || b.name;
            return `    ${tag.replace(/[^a-zA-Z0-9]/g, '_')}: number; // 0 to 1`;
        }).join('\n') : '    position: { x: number, y: number, z: number };'}
}

// Send from phone:
// send({ type: "MODEL_CONTROL", data: controls });
`;

        navigator.clipboard.writeText(code);
        alert("📋 Full model info copied to clipboard!");
    }, [hierarchy, stats, tags, jointControls, modelName]);

    return (
        <div
            className="h-screen w-full bg-zinc-950 overflow-hidden flex"
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
        >
            <BackToLobby />

            {isDragging && (
                <div className="absolute inset-0 bg-amber-500/20 border-4 border-dashed border-amber-500 z-50 flex items-center justify-center">
                    <div className="text-4xl text-amber-400 font-bold">🗂️ DROP .GLB FILE</div>
                </div>
            )}

            {/* Left: 3D Viewport */}
            <div className="flex-1 relative">
                <div className="absolute top-4 left-16 z-10">
                    <div className="flex items-center gap-3">
                        <span className="text-3xl">🔧</span>
                        <div>
                            <h1 className="text-xl font-bold text-amber-400">GLB WORKSHOP</h1>
                            <p className="text-[10px] text-zinc-500 font-mono">{modelName}</p>
                        </div>
                    </div>
                </div>

                <Canvas shadows camera={{ position: [5, 5, 5], fov: 50 }}>
                    <ambientLight intensity={0.4} />
                    <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
                    <pointLight position={[-5, 5, -5]} intensity={0.5} color="#ff8800" />
                    <Suspense fallback={null}>
                        <ModelViewer
                            modelUrl={modelUrl}
                            selectedNode={selectedNode?.path || null}
                            onNodeSelect={handleNodeSelect}
                            onHierarchyLoaded={setHierarchy}
                            onStatsLoaded={setStats}
                            jointControls={jointControls}
                        />
                    </Suspense>
                    <OrbitControls />
                    <gridHelper args={[20, 20, "#333", "#222"]} />
                    <Environment preset="warehouse" />
                </Canvas>

                {/* Export Button */}
                <div className="absolute bottom-6 left-6 flex gap-2">
                    <button
                        onClick={exportModelInfo}
                        className="px-4 py-3 bg-amber-600 hover:bg-amber-500 text-black text-sm font-bold rounded-lg transition-colors flex items-center gap-2"
                    >
                        📋 EXPORT FULL ANALYSIS
                    </button>
                    <button
                        onClick={() => setJointControls({})}
                        className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-lg transition-colors"
                    >
                        🔄 Reset
                    </button>
                </div>
            </div>

            {/* Right: Sidebar */}
            <div className="w-96 bg-zinc-900 border-l border-zinc-800 flex flex-col">
                {/* Stats */}
                <div className="p-3 border-b border-zinc-800">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-amber-500">📊</span>
                        <span className="text-sm font-bold text-white">MODEL STATS</span>
                    </div>
                    <StatsPanel stats={stats} />
                </div>

                {/* Filter Tabs */}
                <div className="flex border-b border-zinc-800 text-[10px]">
                    {[
                        { id: "all", label: "ALL", count: hierarchy.length },
                        { id: "bones", label: "🦴", count: stats?.boneCount || 0 },
                        { id: "meshes", label: "🟢", count: stats?.meshCount || 0 },
                        { id: "tagged", label: "🏷️", count: Object.keys(tags).length },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setFilter(tab.id)}
                            className={`flex-1 py-2 ${filter === tab.id ? "bg-amber-500/20 text-amber-400" : "text-zinc-500 hover:bg-zinc-800"}`}
                        >
                            {tab.label} ({tab.count})
                        </button>
                    ))}
                </div>

                {/* Hierarchy */}
                <div className="flex-1 overflow-y-auto p-2">
                    {hierarchy.length > 0 ? (
                        <HierarchyPanel
                            nodes={hierarchy}
                            selectedNode={selectedNode?.path || null}
                            onSelect={handleNodeSelect}
                            filter={filter}
                            tags={tags}
                            onTagChange={(name, tag) => saveTags({ ...tags, [name]: tag })}
                        />
                    ) : (
                        <p className="text-zinc-600 text-xs p-2">Loading...</p>
                    )}
                </div>

                {/* Controls Panel */}
                <div className="border-t border-zinc-800 max-h-80 overflow-y-auto">
                    <div className="p-3 border-b border-zinc-800 flex items-center gap-2">
                        <span className="text-amber-500">🎛️</span>
                        <span className="text-sm font-bold text-white">CONTROLS</span>
                    </div>
                    <div className="p-3 space-y-3">
                        {selectedNode ? (
                            <>
                                <div className="flex items-center gap-2">
                                    <span>{getNodeIcon(selectedNode.type)}</span>
                                    <span className="text-amber-400 font-mono text-sm truncate">{selectedNode.name}</span>
                                    <span className="text-[10px] text-zinc-500">{selectedNode.type}</span>
                                </div>

                                {/* Tagging */}
                                <div className="bg-zinc-800 rounded p-2 space-y-2">
                                    <div className="text-[10px] text-zinc-500">🏷️ TAG (rename for clarity)</div>
                                    {editingTag ? (
                                        <div className="flex gap-1">
                                            <input
                                                value={tagInput}
                                                onChange={(e) => setTagInput(e.target.value)}
                                                placeholder="e.g. boom_arm"
                                                className="flex-1 px-2 py-1 bg-zinc-700 rounded text-xs text-white"
                                                onKeyDown={(e) => e.key === "Enter" && saveTag()}
                                                autoFocus
                                            />
                                            <button onClick={saveTag} className="px-2 py-1 bg-amber-600 rounded text-xs">✓</button>
                                            <button onClick={() => setEditingTag(false)} className="px-2 py-1 bg-zinc-600 rounded text-xs">✕</button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => { setEditingTag(true); setTagInput(tags[selectedNode.name] || ""); }}
                                            className="w-full px-2 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-xs text-left text-zinc-300"
                                        >
                                            {tags[selectedNode.name] || "Click to add tag..."}
                                        </button>
                                    )}
                                </div>

                                {/* Rotation */}
                                <div className="space-y-2">
                                    <div className="text-[10px] text-zinc-500">ROTATION</div>
                                    {['x', 'y', 'z'].map(axis => (
                                        <JointSlider
                                            key={axis}
                                            label={axis.toUpperCase()}
                                            value={jointControls[`${selectedNode.name}.rotation.${axis}`] || 0}
                                            min={-Math.PI}
                                            max={Math.PI}
                                            onChange={(v) => setJointControls(prev => ({
                                                ...prev,
                                                [`${selectedNode.name}.rotation.${axis}`]: v
                                            }))}
                                        />
                                    ))}
                                </div>

                                {/* Quick Copy */}
                                <button
                                    onClick={() => navigator.clipboard.writeText(`scene.getObjectByName("${selectedNode.name}")`)}
                                    className="w-full px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-lg"
                                >
                                    📋 Copy: getObjectByName("{selectedNode.name}")
                                </button>
                            </>
                        ) : (
                            <p className="text-zinc-600 text-xs">Click a node to control</p>
                        )}
                    </div>
                </div>

                {/* Status */}
                <div className="p-2 bg-zinc-950 border-t border-zinc-800 text-center">
                    <span className={`text-[10px] ${isConnected ? 'text-green-500' : 'text-zinc-600'}`}>
                        {isConnected ? '● CONNECTED' : '○ DESKTOP'}
                    </span>
                </div>
            </div>
        </div>
    );
}
