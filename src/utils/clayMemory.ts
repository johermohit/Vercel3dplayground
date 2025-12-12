export interface ClayFrame {
    x: number;
    y: number;
    force: number;
    radius: number;
    timestamp: number;
}

// Singleton Mutable Buffer
// Bypasses React State / Zustand completely for 60fps+ throughput
export const clayMemory: { current: ClayFrame | null } = {
    current: null
};

// Direct Setter (called by Network Loop)
export function setClayFrame(frame: any) {
    // Basic validation to prevent NaN poisoning
    if (typeof frame.x === 'number' && typeof frame.y === 'number') {
        clayMemory.current = {
            x: frame.x,
            y: frame.y,
            force: frame.force || 0,
            radius: frame.radius || 20,
            timestamp: Date.now()
        };
    }
}

// Direct Getter (called by Render Loop)
export function getClayFrame(): ClayFrame | null {
    return clayMemory.current;
}
