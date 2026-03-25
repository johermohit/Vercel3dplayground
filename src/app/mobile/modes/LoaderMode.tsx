"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";

interface LoaderModeProps {
    isConnected: boolean;
    send: (data: any) => void;
}

interface LoaderControls {
    lift: number;
    bucket: number;
    steering: number;
    throttle: number;
}

/**
 * LoaderMode - JCB Loader phone controller with sliders
 */
export default function LoaderMode({ isConnected, send }: LoaderModeProps) {
    const [mounted, setMounted] = useState(false);
    const controlsRef = useRef<LoaderControls>({
        lift: 0,
        bucket: 0.5,
        steering: 0,
        throttle: 0,
    });
    const [controls, setControls] = useState<LoaderControls>(controlsRef.current);

    // Mark as mounted
    useEffect(() => {
        setMounted(true);
    }, []);

    // Send controls at 30fps
    useEffect(() => {
        if (!isConnected) return;

        const interval = setInterval(() => {
            send({
                type: "LOADER_CONTROL",
                data: controlsRef.current,
            });
        }, 33); // ~30fps

        return () => clearInterval(interval);
    }, [isConnected, send]);

    // Update controls
    const updateControl = useCallback((key: keyof LoaderControls, value: number) => {
        controlsRef.current = { ...controlsRef.current, [key]: value };
        setControls({ ...controlsRef.current });
    }, []);

    // Loading state
    if (!mounted) {
        return (
            <div className="h-full w-full flex items-center justify-center bg-gray-900 text-white">
                <p>Loading loader controls...</p>
            </div>
        );
    }

    return (
        <div
            className="h-full w-full flex flex-col bg-gradient-to-b from-zinc-900 via-amber-950/20 to-black text-white touch-none select-none"
            style={{ overflow: "hidden", position: "fixed", inset: 0 }}
        >
            {/* Header */}
            <div className="p-4 flex justify-between items-center border-b border-amber-500/20">
                <div>
                    <h1 className="text-xl font-bold text-amber-400">🚜 JCB LOADER</h1>
                    <p className="text-[10px] text-gray-500">SLIDE TO CONTROL</p>
                </div>
                <div
                    className={`w-3 h-3 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
                        }`}
                />
            </div>

            {/* Main control area */}
            <div className="flex-1 flex flex-col justify-center px-6 py-4 gap-6">
                {/* Lift Slider */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-amber-400 font-bold">⬆️ LIFT</span>
                        <span className="text-xs text-gray-500 font-mono">{Math.round(controls.lift * 100)}%</span>
                    </div>
                    <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={controls.lift}
                        onChange={(e) => updateControl("lift", parseFloat(e.target.value))}
                        className="w-full h-8 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                        style={{ WebkitAppearance: "none" }}
                    />
                    <div className="flex justify-between text-[10px] text-gray-600">
                        <span>DOWN</span>
                        <span>UP</span>
                    </div>
                </div>

                {/* Bucket Slider */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-amber-400 font-bold">🪣 BUCKET</span>
                        <span className="text-xs text-gray-500 font-mono">{Math.round(controls.bucket * 100)}%</span>
                    </div>
                    <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={controls.bucket}
                        onChange={(e) => updateControl("bucket", parseFloat(e.target.value))}
                        className="w-full h-8 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                    <div className="flex justify-between text-[10px] text-gray-600">
                        <span>DUMP</span>
                        <span>SCOOP</span>
                    </div>
                </div>

                {/* Steering Slider */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-blue-400 font-bold">🔄 STEERING</span>
                        <span className="text-xs text-gray-500 font-mono">
                            {controls.steering > 0.05 ? "→" : controls.steering < -0.05 ? "←" : "○"}
                            {Math.round(Math.abs(controls.steering) * 100)}%
                        </span>
                    </div>
                    <input
                        type="range"
                        min={-1}
                        max={1}
                        step={0.01}
                        value={controls.steering}
                        onChange={(e) => updateControl("steering", parseFloat(e.target.value))}
                        className="w-full h-8 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <div className="flex justify-between text-[10px] text-gray-600">
                        <span>◀ LEFT</span>
                        <span>RIGHT ▶</span>
                    </div>
                </div>

                {/* Throttle Slider */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-green-400 font-bold">🏎️ THROTTLE</span>
                        <span className="text-xs text-gray-500 font-mono">
                            {controls.throttle > 0.05 ? "▲" : controls.throttle < -0.05 ? "▼" : "○"}
                            {Math.round(Math.abs(controls.throttle) * 100)}%
                        </span>
                    </div>
                    <input
                        type="range"
                        min={-1}
                        max={1}
                        step={0.01}
                        value={controls.throttle}
                        onChange={(e) => updateControl("throttle", parseFloat(e.target.value))}
                        className="w-full h-8 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-green-500"
                    />
                    <div className="flex justify-between text-[10px] text-gray-600">
                        <span>▼ REVERSE</span>
                        <span>FORWARD ▲</span>
                    </div>
                </div>
            </div>

            {/* Reset Button */}
            <div className="px-6 pb-4">
                <button
                    onClick={() => {
                        const reset = { lift: 0, bucket: 0.5, steering: 0, throttle: 0 };
                        controlsRef.current = reset;
                        setControls(reset);
                    }}
                    className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 rounded-lg text-zinc-400 text-sm font-bold transition-colors"
                >
                    🔄 RESET CONTROLS
                </button>
            </div>

            {/* Footer */}
            <div className="p-3 bg-black/30 text-[10px] text-center text-amber-500/50 border-t border-white/5">
                JCB 435B LOADER · {isConnected ? "CONNECTED" : "WAITING"}
            </div>
        </div>
    );
}
