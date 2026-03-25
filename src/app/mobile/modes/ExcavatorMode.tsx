"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";

interface ControlState {
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    armUp: boolean;
    armDown: boolean;
    bucketUp: boolean;
    bucketDown: boolean;
}

interface ExcavatorModeProps {
    isConnected: boolean;
    send: (data: any) => void;
}

/**
 * ExcavatorMode - D-pad and button controls for excavator
 */
export default function ExcavatorMode({ isConnected, send }: ExcavatorModeProps) {
    const [mounted, setMounted] = useState(false);
    const controlsRef = useRef<ControlState>({
        forward: false,
        backward: false,
        left: false,
        right: false,
        armUp: false,
        armDown: false,
        bucketUp: false,
        bucketDown: false,
    });
    const [controls, setControls] = useState<ControlState>(controlsRef.current);

    // Mark as mounted
    useEffect(() => {
        setMounted(true);
    }, []);

    // Send controls at 30fps
    useEffect(() => {
        if (!isConnected) return;

        const interval = setInterval(() => {
            send({
                type: "EXCAVATOR_CONTROL",
                data: controlsRef.current,
            });
        }, 33); // ~30fps

        return () => clearInterval(interval);
    }, [isConnected, send]);

    // Button handlers
    const handleButtonDown = useCallback((button: keyof ControlState) => {
        controlsRef.current = { ...controlsRef.current, [button]: true };
        setControls({ ...controlsRef.current });
        // Haptic feedback
        if (navigator.vibrate) navigator.vibrate(10);
    }, []);

    const handleButtonUp = useCallback((button: keyof ControlState) => {
        controlsRef.current = { ...controlsRef.current, [button]: false };
        setControls({ ...controlsRef.current });
    }, []);

    // Touch event handlers for a button
    const createButtonProps = (button: keyof ControlState) => ({
        onTouchStart: (e: React.TouchEvent) => {
            e.preventDefault();
            handleButtonDown(button);
        },
        onTouchEnd: (e: React.TouchEvent) => {
            e.preventDefault();
            handleButtonUp(button);
        },
        onMouseDown: () => handleButtonDown(button),
        onMouseUp: () => handleButtonUp(button),
        onMouseLeave: () => handleButtonUp(button),
    });

    // Loading state
    if (!mounted) {
        return (
            <div className="h-full w-full flex items-center justify-center bg-gray-900 text-white">
                <p>Loading excavator controls...</p>
            </div>
        );
    }

    return (
        <div
            className="h-full w-full flex flex-col bg-gradient-to-b from-gray-900 via-amber-950/30 to-black text-white touch-none select-none"
            style={{ overflow: "hidden", position: "fixed", inset: 0 }}
        >
            {/* Header */}
            <div className="p-4 flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-bold text-amber-400">🚜 EXCAVATOR</h1>
                    <p className="text-[10px] text-gray-500">HOLD BUTTONS TO CONTROL</p>
                </div>
                <div
                    className={`w-3 h-3 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
                        }`}
                />
            </div>

            {/* Main control area */}
            <div className="flex-1 flex justify-between items-center px-8">
                {/* Left side: D-pad for movement */}
                <div className="flex flex-col items-center">
                    <p className="text-[10px] text-gray-600 mb-2">DRIVE</p>
                    <div className="grid grid-cols-3 gap-1">
                        <div />
                        <button
                            {...createButtonProps("forward")}
                            className={`w-14 h-14 rounded-lg flex items-center justify-center text-2xl transition-all ${controls.forward
                                    ? "bg-amber-500 text-black shadow-lg shadow-amber-500/50 scale-95"
                                    : "bg-gray-800 text-gray-400 active:bg-amber-500 active:text-black"
                                }`}
                        >
                            ▲
                        </button>
                        <div />
                        <button
                            {...createButtonProps("left")}
                            className={`w-14 h-14 rounded-lg flex items-center justify-center text-2xl transition-all ${controls.left
                                    ? "bg-amber-500 text-black shadow-lg shadow-amber-500/50 scale-95"
                                    : "bg-gray-800 text-gray-400 active:bg-amber-500 active:text-black"
                                }`}
                        >
                            ◀
                        </button>
                        <div className="w-14 h-14 rounded-lg bg-gray-900 flex items-center justify-center">
                            <div className="w-4 h-4 rounded-full bg-gray-700" />
                        </div>
                        <button
                            {...createButtonProps("right")}
                            className={`w-14 h-14 rounded-lg flex items-center justify-center text-2xl transition-all ${controls.right
                                    ? "bg-amber-500 text-black shadow-lg shadow-amber-500/50 scale-95"
                                    : "bg-gray-800 text-gray-400 active:bg-amber-500 active:text-black"
                                }`}
                        >
                            ▶
                        </button>
                        <div />
                        <button
                            {...createButtonProps("backward")}
                            className={`w-14 h-14 rounded-lg flex items-center justify-center text-2xl transition-all ${controls.backward
                                    ? "bg-amber-500 text-black shadow-lg shadow-amber-500/50 scale-95"
                                    : "bg-gray-800 text-gray-400 active:bg-amber-500 active:text-black"
                                }`}
                        >
                            ▼
                        </button>
                        <div />
                    </div>
                </div>

                {/* Right side: Arm and bucket buttons */}
                <div className="flex flex-col items-center gap-4">
                    {/* Arm controls */}
                    <div className="flex flex-col items-center">
                        <p className="text-[10px] text-gray-600 mb-1">ARM</p>
                        <div className="flex flex-col gap-1">
                            <button
                                {...createButtonProps("armUp")}
                                className={`w-16 h-10 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${controls.armUp
                                        ? "bg-blue-500 text-white shadow-lg shadow-blue-500/50 scale-95"
                                        : "bg-gray-800 text-gray-400"
                                    }`}
                            >
                                ↑ UP
                            </button>
                            <button
                                {...createButtonProps("armDown")}
                                className={`w-16 h-10 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${controls.armDown
                                        ? "bg-blue-500 text-white shadow-lg shadow-blue-500/50 scale-95"
                                        : "bg-gray-800 text-gray-400"
                                    }`}
                            >
                                ↓ DOWN
                            </button>
                        </div>
                    </div>

                    {/* Bucket controls */}
                    <div className="flex flex-col items-center">
                        <p className="text-[10px] text-gray-600 mb-1">BUCKET</p>
                        <div className="flex flex-col gap-1">
                            <button
                                {...createButtonProps("bucketUp")}
                                className={`w-16 h-10 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${controls.bucketUp
                                        ? "bg-green-500 text-white shadow-lg shadow-green-500/50 scale-95"
                                        : "bg-gray-800 text-gray-400"
                                    }`}
                            >
                                ⟳ OPEN
                            </button>
                            <button
                                {...createButtonProps("bucketDown")}
                                className={`w-16 h-10 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${controls.bucketDown
                                        ? "bg-green-500 text-white shadow-lg shadow-green-500/50 scale-95"
                                        : "bg-gray-800 text-gray-400"
                                    }`}
                            >
                                ⟲ CLOSE
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="p-3 bg-black/30 text-[10px] text-center text-amber-500/50 border-t border-white/5">
                EXCAVATOR · {isConnected ? "OPERATING" : "WAITING"}
            </div>
        </div>
    );
}
