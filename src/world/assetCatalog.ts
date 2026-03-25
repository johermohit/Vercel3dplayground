/**
 * World Asset Catalog
 * 
 * Centralized catalog of all 3D assets for the JCB World.
 * Assets are organized by category and include metadata for scalable placement.
 * 
 * SCALE NOTE: JCB is scaled 30x. Kenney assets are ~1 unit = 1 meter.
 * Buildings should be ~20x scale to look proportional.
 */

// Asset categories
export type AssetCategory =
    | 'buildings/industrial'
    | 'buildings/suburban'
    | 'props/skatepark'
    | 'props/fences'
    | 'ground/paths'
    | 'nature';

// Asset definition with metadata
export interface WorldAsset {
    id: string;
    name: string;
    path: string;
    category: AssetCategory;
    scale?: number;  // Default scale multiplier
    groundLevel?: number;  // Y offset to sit on ground
    collidable?: boolean;  // Whether to add physics collision
}

// GLOBAL SCALE FACTOR - adjust this to scale entire world
const BUILDING_SCALE = 20;
const PROP_SCALE = 15;
const NATURE_SCALE = 25;

// Industrial Buildings (Kenney City Kit Industrial)
export const INDUSTRIAL_BUILDINGS: WorldAsset[] = [
    { id: 'ind-a', name: 'Warehouse A', path: '/world/buildings/industrial/building-a.glb', category: 'buildings/industrial', scale: BUILDING_SCALE, groundLevel: 0, collidable: true },
    { id: 'ind-b', name: 'Factory B', path: '/world/buildings/industrial/building-b.glb', category: 'buildings/industrial', scale: BUILDING_SCALE, groundLevel: 0, collidable: true },
    { id: 'ind-c', name: 'Industrial C', path: '/world/buildings/industrial/building-c.glb', category: 'buildings/industrial', scale: BUILDING_SCALE, groundLevel: 0, collidable: true },
    { id: 'ind-d', name: 'Storage D', path: '/world/buildings/industrial/building-d.glb', category: 'buildings/industrial', scale: BUILDING_SCALE, groundLevel: 0, collidable: true },
    { id: 'ind-e', name: 'Plant E', path: '/world/buildings/industrial/building-e.glb', category: 'buildings/industrial', scale: BUILDING_SCALE, groundLevel: 0, collidable: true },
    { id: 'ind-f', name: 'Mill F', path: '/world/buildings/industrial/building-f.glb', category: 'buildings/industrial', scale: BUILDING_SCALE, groundLevel: 0, collidable: true },
    { id: 'ind-g', name: 'Hangar G', path: '/world/buildings/industrial/building-g.glb', category: 'buildings/industrial', scale: BUILDING_SCALE, groundLevel: 0, collidable: true },
    { id: 'ind-h', name: 'Shed H', path: '/world/buildings/industrial/building-h.glb', category: 'buildings/industrial', scale: BUILDING_SCALE, groundLevel: 0, collidable: true },
    { id: 'chimney-basic', name: 'Basic Chimney', path: '/world/buildings/industrial/chimney-basic.glb', category: 'buildings/industrial', scale: BUILDING_SCALE, groundLevel: 0 },
    { id: 'chimney-large', name: 'Large Chimney', path: '/world/buildings/industrial/chimney-large.glb', category: 'buildings/industrial', scale: BUILDING_SCALE, groundLevel: 0 },
    { id: 'detail-tank', name: 'Storage Tank', path: '/world/buildings/industrial/detail-tank.glb', category: 'buildings/industrial', scale: BUILDING_SCALE, groundLevel: 0, collidable: true },
];

// Suburban Buildings (Kenney City Kit Suburban)
export const SUBURBAN_BUILDINGS: WorldAsset[] = [
    { id: 'sub-a', name: 'House A', path: '/world/buildings/suburban/building-type-a.glb', category: 'buildings/suburban', scale: BUILDING_SCALE, groundLevel: 0, collidable: true },
    { id: 'sub-b', name: 'House B', path: '/world/buildings/suburban/building-type-b.glb', category: 'buildings/suburban', scale: BUILDING_SCALE, groundLevel: 0, collidable: true },
    { id: 'sub-c', name: 'House C', path: '/world/buildings/suburban/building-type-c.glb', category: 'buildings/suburban', scale: BUILDING_SCALE, groundLevel: 0, collidable: true },
    { id: 'sub-d', name: 'Shop D', path: '/world/buildings/suburban/building-type-d.glb', category: 'buildings/suburban', scale: BUILDING_SCALE, groundLevel: 0, collidable: true },
    { id: 'sub-e', name: 'Store E', path: '/world/buildings/suburban/building-type-e.glb', category: 'buildings/suburban', scale: BUILDING_SCALE, groundLevel: 0, collidable: true },
    { id: 'sub-f', name: 'Office F', path: '/world/buildings/suburban/building-type-f.glb', category: 'buildings/suburban', scale: BUILDING_SCALE, groundLevel: 0, collidable: true },
];

// Skatepark Props (Kenney Mini Skate)
export const SKATEPARK_PROPS: WorldAsset[] = [
    { id: 'half-pipe', name: 'Half Pipe', path: '/world/props/skatepark/half-pipe.glb', category: 'props/skatepark', scale: PROP_SCALE, groundLevel: 0, collidable: true },
    { id: 'bowl-corner-inner', name: 'Bowl Corner Inner', path: '/world/props/skatepark/bowl-corner-inner.glb', category: 'props/skatepark', scale: PROP_SCALE, groundLevel: 0, collidable: true },
    { id: 'bowl-corner-outer', name: 'Bowl Corner Outer', path: '/world/props/skatepark/bowl-corner-outer.glb', category: 'props/skatepark', scale: PROP_SCALE, groundLevel: 0, collidable: true },
    { id: 'bowl-side', name: 'Bowl Side', path: '/world/props/skatepark/bowl-side.glb', category: 'props/skatepark', scale: PROP_SCALE, groundLevel: 0, collidable: true },
    { id: 'obstacle-box', name: 'Obstacle Box', path: '/world/props/skatepark/obstacle-box.glb', category: 'props/skatepark', scale: PROP_SCALE, groundLevel: 0, collidable: true },
    { id: 'rail-low', name: 'Rail Low', path: '/world/props/skatepark/rail-low.glb', category: 'props/skatepark', scale: PROP_SCALE, groundLevel: 0, collidable: true },
    { id: 'rail-high', name: 'Rail High', path: '/world/props/skatepark/rail-high.glb', category: 'props/skatepark', scale: PROP_SCALE, groundLevel: 0, collidable: true },
    { id: 'rail-curve', name: 'Rail Curve', path: '/world/props/skatepark/rail-curve.glb', category: 'props/skatepark', scale: PROP_SCALE, groundLevel: 0, collidable: true },
    { id: 'steps', name: 'Steps', path: '/world/props/skatepark/steps.glb', category: 'props/skatepark', scale: PROP_SCALE, groundLevel: 0, collidable: true },
    { id: 'pallet', name: 'Pallet', path: '/world/props/skatepark/pallet.glb', category: 'props/skatepark', scale: PROP_SCALE, groundLevel: 0, collidable: true },
    { id: 'floor-concrete', name: 'Concrete Floor', path: '/world/props/skatepark/floor-concrete.glb', category: 'props/skatepark', scale: PROP_SCALE, groundLevel: 0 },
    { id: 'floor-wood', name: 'Wood Floor', path: '/world/props/skatepark/floor-wood.glb', category: 'props/skatepark', scale: PROP_SCALE, groundLevel: 0 },
];

// Fences
export const FENCES: WorldAsset[] = [
    { id: 'fence-1x2', name: 'Fence 1x2', path: '/world/props/fences/fence-1x2.glb', category: 'props/fences', scale: PROP_SCALE, groundLevel: 0, collidable: true },
    { id: 'fence-1x3', name: 'Fence 1x3', path: '/world/props/fences/fence-1x3.glb', category: 'props/fences', scale: PROP_SCALE, groundLevel: 0, collidable: true },
    { id: 'fence-2x2', name: 'Fence 2x2', path: '/world/props/fences/fence-2x2.glb', category: 'props/fences', scale: PROP_SCALE, groundLevel: 0, collidable: true },
    { id: 'fence-low', name: 'Fence Low', path: '/world/props/fences/fence-low.glb', category: 'props/fences', scale: PROP_SCALE, groundLevel: 0, collidable: true },
    { id: 'fence', name: 'Fence', path: '/world/props/fences/fence.glb', category: 'props/fences', scale: PROP_SCALE, groundLevel: 0, collidable: true },
];

// Paths & Driveways
export const PATHS: WorldAsset[] = [
    { id: 'path-long', name: 'Path Long', path: '/world/ground/paths/path-long.glb', category: 'ground/paths', scale: PROP_SCALE, groundLevel: 0.1 },
    { id: 'path-short', name: 'Path Short', path: '/world/ground/paths/path-short.glb', category: 'ground/paths', scale: PROP_SCALE, groundLevel: 0.1 },
    { id: 'path-stones-long', name: 'Stone Path Long', path: '/world/ground/paths/path-stones-long.glb', category: 'ground/paths', scale: PROP_SCALE, groundLevel: 0.1 },
    { id: 'path-stones-short', name: 'Stone Path Short', path: '/world/ground/paths/path-stones-short.glb', category: 'ground/paths', scale: PROP_SCALE, groundLevel: 0.1 },
    { id: 'driveway-long', name: 'Driveway Long', path: '/world/ground/paths/driveway-long.glb', category: 'ground/paths', scale: PROP_SCALE, groundLevel: 0.1 },
    { id: 'driveway-short', name: 'Driveway Short', path: '/world/ground/paths/driveway-short.glb', category: 'ground/paths', scale: PROP_SCALE, groundLevel: 0.1 },
];

// Nature
export const NATURE: WorldAsset[] = [
    { id: 'tree-large', name: 'Large Tree', path: '/world/nature/tree-large.glb', category: 'nature', scale: NATURE_SCALE, groundLevel: 0 },
    { id: 'tree-small', name: 'Small Tree', path: '/world/nature/tree-small.glb', category: 'nature', scale: NATURE_SCALE, groundLevel: 0 },
    { id: 'planter', name: 'Planter', path: '/world/nature/planter.glb', category: 'nature', scale: PROP_SCALE, groundLevel: 0, collidable: true },
];

// All assets combined
export const ALL_ASSETS: WorldAsset[] = [
    ...INDUSTRIAL_BUILDINGS,
    ...SUBURBAN_BUILDINGS,
    ...SKATEPARK_PROPS,
    ...FENCES,
    ...PATHS,
    ...NATURE,
];

// Get asset by ID
export function getAssetById(id: string): WorldAsset | undefined {
    return ALL_ASSETS.find(a => a.id === id);
}

// Get assets by category
export function getAssetsByCategory(category: AssetCategory): WorldAsset[] {
    return ALL_ASSETS.filter(a => a.category === category);
}

// World placement definition - where to put assets in the world
export interface WorldPlacement {
    assetId: string;
    position: [number, number, number];
    rotation?: [number, number, number];  // Euler angles in radians
    scale?: number;  // Override default scale
}

// Example world layout - SPREAD OUT for bigger assets
export const DEFAULT_WORLD_LAYOUT: WorldPlacement[] = [
    // Industrial zone (back left) - spread apart more
    { assetId: 'ind-a', position: [-80, 0, -80], rotation: [0, 0, 0] },
    { assetId: 'ind-b', position: [-80, 0, -40], rotation: [0, Math.PI / 2, 0] },
    { assetId: 'chimney-large', position: [-60, 0, -70] },
    { assetId: 'detail-tank', position: [-50, 0, -80] },

    // Suburban zone (back right)
    { assetId: 'sub-a', position: [80, 0, -80], rotation: [0, Math.PI, 0] },
    { assetId: 'sub-b', position: [80, 0, -40], rotation: [0, Math.PI, 0] },
    { assetId: 'sub-c', position: [40, 0, -80], rotation: [0, -Math.PI / 2, 0] },

    // Skatepark zone (front right)
    { assetId: 'half-pipe', position: [60, 0, 60] },
    { assetId: 'obstacle-box', position: [80, 0, 40] },
    { assetId: 'rail-low', position: [40, 0, 70] },
    { assetId: 'steps', position: [90, 0, 60] },

    // Trees around the area - scattered
    { assetId: 'tree-large', position: [-30, 0, 30] },
    { assetId: 'tree-small', position: [30, 0, -30] },
    { assetId: 'tree-large', position: [-50, 0, -50] },
    { assetId: 'tree-small', position: [50, 0, 50] },
    { assetId: 'tree-large', position: [0, 0, -60] },

    // Fences around perimeter
    { assetId: 'fence-1x3', position: [-100, 0, 0] },
    { assetId: 'fence-1x3', position: [100, 0, 0] },
];
