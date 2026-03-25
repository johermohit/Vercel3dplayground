"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useOrientationSensor } from "../hooks/useOrientationSensor";

interface DriveModeProps {
    isConnected: boolean;
    send: (data: any) => void;
}

/**
 * DriveMode - Police Chase steering wheel controller
 * Sends orientation data for car steering and throttle
 */
export default function DriveMode({ isConnected, send }: DriveModeProps) {
    const [mounted, setMounted] = useState(false);

    // Send orientation to desktop
    const handleOrientationChange = useCallback(
        (data: { alpha: number; beta: number; gamma: number }) => {
            send({
                type: "ORIENTATION",
                data,
            });
        },
        [send]
    );

    const { orientation } = useOrientationSensor(handleOrientationChange);

    // Calculate steering and throttle from orientation
    const steering = Math.max(-1, Math.min(1, (orientation.gamma || 0) / 45));
    const throttle = Math.max(-1, Math.min(1, (orientation.beta - 45) / 45));

    // Mark as mounted for hydration
    useEffect(() => {
        setMounted(true);
    }, []);

    // Loading state during SSR
    if (!mounted) {
        return (
            <div className="h-full w-full flex items-center justify-center bg-gray-900 text-white">
                <p>Loading drive mode...</p>
            </div>
        );
    }

    return (
        <div
            className="h-full w-full flex flex-col bg-gradient-to-b from-gray-900 via-indigo-950/30 to-black text-white touch-none select-none overscroll-none"
            style={{ overflow: "hidden", position: "fixed", inset: 0 }}
        >
            {/* Header */}
            <div className="p-4 flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-bold text-indigo-400">🚔 DRIVE</h1>
                    <p className="text-[10px] text-gray-500">TILT TO STEER</p>
                </div>
                <div
                    className={`w-3 h-3 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
                        }`}
                />
            </div>

            {/* Main steering area */}
            <div className="flex-1 flex flex-col items-center justify-center gap-8">
                {/* Steering wheel visual */}
                <div className="relative w-64 h-64">
                    {/* Outer ring */}
                    <div className="absolute inset-0 border-4 border-indigo-500/30 rounded-full" />

                    {/* Steering indicator */}
                    <div
                        className="absolute inset-4 border-4 border-indigo-400 rounded-full transition-transform duration-75"
                        style={{ transform: `rotate(${steering * 45}deg)` }}
                    >
                        {/* Wheel markers */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 w-8 h-2 bg-indigo-400 rounded-full" />
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1 w-4 h-1 bg-indigo-400/50 rounded-full" />
                    </div>

                    {/* Center */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                            <div className="text-3xl font-bold text-indigo-300">
                                {Math.round(steering * 100)}°
                            </div>
                            <div className="text-xs text-gray-500">STEER</div>
                        </div>
                    </div>
                </div>

                {/* Throttle bar */}
                <div className="w-64">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>BRAKE</span>
                        <span>THROTTLE</span>
                    </div>
                    <div className="h-6 bg-gray-800 rounded-full overflow-hidden relative">
                        {/* Center line */}
                        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gray-600" />
                        {/* Throttle fill */}
                        <div
                            className={`absolute top-0 bottom-0 transition-all duration-75 ${throttle >= 0 ? "bg-green-500" : "bg-red-500"
                                }`}
                            style={{
                                left: throttle >= 0 ? "50%" : `${50 + throttle * 50}%`,
                                width: `${Math.abs(throttle) * 50}%`,
                            }}
                        />
                    </div>
                    <div className="text-center mt-2 text-2xl font-bold text-white">
                        {throttle >= 0 ? "⬆️" : "⬇️"} {Math.abs(Math.round(throttle * 100))}%
                    </div>
                </div>
            </div>

            {/* Instructions */}
            <div className="p-4 text-center text-gray-500 text-xs">
                <p>📱 TILT LEFT/RIGHT → Steer</p>
                <p>📱 TILT FORWARD → Accelerate</p>
                <p>📱 TILT BACK → Brake</p>
            </div>

            {/* Footer */}
            <div className="p-2 bg-black/30 text-[10px] text-center text-indigo-500/50 border-t border-white/5">
                POLICE CHASE · {isConnected ? "DRIVING" : "WAITING"}
            </div>
        </div>
    );
}
