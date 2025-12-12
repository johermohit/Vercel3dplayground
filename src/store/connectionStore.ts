import { create } from 'zustand';

interface ConnectionState {
    sessionId: string | null;
    isConnected: boolean;
    peerId: string | null;
    isHost: boolean;
    rotation: { x: number; y: number };
    color: string;
    intensity: number;
    glitch: boolean;
    sensorData: {
        battery?: { level: number; charging: boolean };
        orientation?: { alpha: number; beta: number; gamma: number };
        acceleration?: { x: number; y: number; z: number };
        screen?: { width: number; height: number; type: string };
        touch?: { force: number; radius: number; angle: number };
        clay?: { x: number; y: number; dx?: number; dy?: number; force: number; radius: number };
    };
    setSessionId: (id: string) => void;
    setConnected: (status: boolean) => void;
    setRotation: (rot: { x: number; y: number }) => void;
    setColor: (color: string) => void;
    setIntensity: (val: number) => void;
    setGlitch: (active: boolean) => void;
    setSensorData: (data: any) => void;
    setClayInput: (data: any) => void;
    generateSessionId: () => string;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
    sessionId: null,
    isConnected: false,
    peerId: null,
    isHost: false,
    rotation: { x: 0, y: 0 },
    color: 'orange',
    intensity: 0,
    glitch: false,
    sensorData: {},

    setSessionId: (id) => set({ sessionId: id }),
    setConnected: (status) => set({ isConnected: status }),
    setRotation: (rot) => set({ rotation: rot }),
    setColor: (color) => set({ color }),
    setIntensity: (val) => set({ intensity: val }),
    setGlitch: (active) => set({ glitch: active }),
    setSensorData: (data) => set((state) => ({
        sensorData: { ...state.sensorData, ...data }
    })),
    setClayInput: (data: any) => set((state) => ({
        // We'll store clayInput in sensorData.clay for simplicity, or a top level
        sensorData: { ...state.sensorData, clay: data }
    })),

    generateSessionId: () => {
        const newId = crypto.randomUUID().split('-')[0].toUpperCase();
        set({ sessionId: newId, isHost: true });
        return newId;
    }
}));
