"use client";

import React, { useMemo, Suspense } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { WorldPlacement, getAssetById } from "./assetCatalog";

/**
 * WorldAssetInstance - Loads and renders a single asset from the catalog
 */
function WorldAssetInstance({
    assetId,
    position,
    rotation = [0, 0, 0],
    scale: overrideScale
}: WorldPlacement) {
    const asset = getAssetById(assetId);

    if (!asset) {
        console.warn(`Asset not found: ${assetId}`);
        return null;
    }

    const { scene } = useGLTF(asset.path);
    const clonedScene = useMemo(() => scene.clone(), [scene]);

    const finalScale = overrideScale ?? asset.scale ?? 1;
    const yOffset = asset.groundLevel ?? 0;

    return (
        <primitive
            object={clonedScene}
            position={[position[0], position[1] + yOffset, position[2]]}
            rotation={rotation}
            scale={finalScale}
        />
    );
}

/**
 * WorldLoader - Loads multiple assets from a layout definition
 */
export function WorldLoader({ layout }: { layout: WorldPlacement[] }) {
    return (
        <Suspense fallback={null}>
            {layout.map((placement, index) => (
                <WorldAssetInstance key={`${placement.assetId}-${index}`} {...placement} />
            ))}
        </Suspense>
    );
}

/**
 * RandomScatter - Scatter assets randomly around an area
 */
export function RandomScatter({
    assetIds,
    count,
    areaSize = 50,
    yPosition = 0,
}: {
    assetIds: string[];
    count: number;
    areaSize?: number;
    yPosition?: number;
}) {
    const placements = useMemo(() => {
        const result: WorldPlacement[] = [];
        for (let i = 0; i < count; i++) {
            const assetId = assetIds[Math.floor(Math.random() * assetIds.length)];
            result.push({
                assetId,
                position: [
                    (Math.random() - 0.5) * areaSize,
                    yPosition,
                    (Math.random() - 0.5) * areaSize,
                ],
                rotation: [0, Math.random() * Math.PI * 2, 0],
            });
        }
        return result;
    }, [assetIds, count, areaSize, yPosition]);

    return <WorldLoader layout={placements} />;
}

/**
 * GridLayout - Place assets in a grid pattern
 */
export function GridLayout({
    assetId,
    rows,
    cols,
    spacing = 10,
    startPosition = [0, 0, 0] as [number, number, number],
}: {
    assetId: string;
    rows: number;
    cols: number;
    spacing?: number;
    startPosition?: [number, number, number];
}) {
    const placements = useMemo(() => {
        const result: WorldPlacement[] = [];
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                result.push({
                    assetId,
                    position: [
                        startPosition[0] + col * spacing,
                        startPosition[1],
                        startPosition[2] + row * spacing,
                    ],
                });
            }
        }
        return result;
    }, [assetId, rows, cols, spacing, startPosition]);

    return <WorldLoader layout={placements} />;
}

// Preload commonly used assets
export function preloadWorldAssets(assetPaths: string[]) {
    assetPaths.forEach(path => useGLTF.preload(path));
}
