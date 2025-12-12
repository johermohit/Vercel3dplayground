"use client";

import React, { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useConnectionStore } from "@/store/connectionStore";
import type { Peer, DataConnection } from "peerjs";

function MobileControllerContent() {
    const searchParams = useSearchParams();
    const sessionParam = searchParams.get("session");
    const modeParam = searchParams.get("mode") || 'cube';
    const { setSessionId, setConnected, isConnected } = useConnectionStore();
    const [status, setStatus] = useState("Idle");
    const connRef = useRef<DataConnection | null>(null);
    const lastTouchRef = useRef<{ x: number, y: number } | null>(null);
    const [intensity, setIntensity] = useState(0);

    // Initialize Connection (Client)
    useEffect(() => {
        if (sessionParam) {
            setSessionId(sessionParam);
            const initClient = async () => {
                const { Peer } = await import('peerjs');
                const peer = new Peer();

                peer.on('open', () => {
                    setStatus("Connecting...");
                    const conn = peer.connect(sessionParam);

                    conn.on('open', () => {
                        setStatus("Connected");
                        setConnected(true);
                        connRef.current = conn;
                    });

                    conn.on('close', () => {
                        setStatus("Disconnected");
                        setConnected(false);
                    });
                });
            };
            initClient();
        }
    }, [sessionParam, setSessionId, setConnected]);

    // --- GENERIC HANDLERS ---
    const handleTouchStart = (e: React.TouchEvent) => {
        const touch = e.touches[0];
        lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!connRef.current || !connRef.current.open || !lastTouchRef.current) return;

        const touch = e.touches[0];
        const deltaX = touch.clientX - lastTouchRef.current.x;
        const deltaY = touch.clientY - lastTouchRef.current.y;

        lastTouchRef.current = { x: touch.clientX, y: touch.clientY };

        connRef.current.send({
            type: 'ROTATE',
            x: deltaX,
            y: deltaY
        });
    };

    const sendColor = (color: string) => {
        if (connRef.current && connRef.current.open) {
            connRef.current.send({ type: 'COLOR', color });
        }
    };

    // --- HYPER MODE HANDLERS ---
    const sliderRef = useRef<HTMLDivElement>(null);

    const handleSliderTouch = (e: React.TouchEvent) => {
        if (!sliderRef.current) return;

        const touch = e.touches[0];
        const rect = sliderRef.current.getBoundingClientRect();
        let val = 1.0 - ((touch.clientY - rect.top) / rect.height);
        val = Math.max(0, Math.min(1, val));

        setIntensity(val);

        if (connRef.current && connRef.current.open) {
            connRef.current.send({ type: 'INTENSITY', value: val });
        }
    };

    const toggleGlitch = (active: boolean) => {
        if (connRef.current && connRef.current.open) {
            connRef.current.send({ type: 'GLITCH', active });
        }
    };

    // --- TOUCH TEST HANDLER (Shared) ---
    const handleTouchTest = (e: React.TouchEvent) => {
        e.preventDefault();
        if (!connRef.current || !connRef.current.open) return;

        const t = e.touches[0] as any;
        const payload = {
            force: t.force || 0,
            radius: t.radiusX || 0,
            angle: t.rotationAngle || 0
        };
        // Only log in sensor mode, but always send
        if (modeParam === 'sensor') {
            // We can't easily access addLog here unless we hoist state, 
            // but sending data is the priority.
        }
        connRef.current.send({ type: 'SENSOR_DATA', payload: { touch: payload } });
    };

    // --- SENSOR LAB MODE ---
    if (modeParam === 'sensor') {
        const [logs, setLogs] = useState<string[]>([]);
        const [vibrateStatus, setVibrateStatus] = useState("Idle");
        const [iosPermissionNeeded, setIosPermissionNeeded] = useState(false);
        const [origin, setOrigin] = useState("...");

        const addLog = (msg: string) => {
            console.log(msg);
            setLogs(prev => [`[${new Date().toLocaleTimeString().split(' ')[0]}] ${msg}`, ...prev].slice(0, 8));
        };

        // Sensor Hooks
        useEffect(() => {
            setOrigin(window.location.origin);
            if (!connRef.current || !connRef.current.open) return;

            const sendData = (payload: any) => {
                connRef.current?.send({ type: 'SENSOR_DATA', payload });
            };

            addLog("Checking Sensors...");

            // 0. iOS Permission Check
            if (typeof DeviceOrientationEvent !== 'undefined' && typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
                setIosPermissionNeeded(true);
                addLog("iOS Detected: Permission Required");
            }

            // 1. Screen Info
            sendData({
                screen: {
                    width: window.innerWidth,
                    height: window.innerHeight,
                    type: screen.orientation?.type || 'unknown'
                }
            });

            // 2. Battery
            if ('getBattery' in navigator) {
                (navigator as any).getBattery().then((battery: any) => {
                    addLog(`Battery Detected: ${(battery.level * 100).toFixed(0)}%`);
                    const updateBattery = () => {
                        sendData({
                            battery: {
                                level: battery.level * 100,
                                charging: battery.charging
                            }
                        });
                    };
                    updateBattery();
                    battery.addEventListener('levelchange', updateBattery);
                    battery.addEventListener('chargingchange', updateBattery);
                }).catch((e: any) => addLog(`Battery Err: ${e.message}`));
            } else {
                addLog("Battery API: Not supported");
            }

            // 3. Orientation
            if (typeof DeviceOrientationEvent !== 'undefined' && !iosPermissionNeeded) {
                const handleOrientation = (e: DeviceOrientationEvent) => {
                    if (e.alpha === null) return;
                    sendData({
                        orientation: {
                            alpha: e.alpha,
                            beta: e.beta,
                            gamma: e.gamma
                        }
                    });
                };
                window.addEventListener('deviceorientation', handleOrientation);
                // Check if we actually get data (simple timeout check could go here)
                setTimeout(() => {
                    // If we haven't received data, we might want to log it, 
                    // but for now we rely on the user seeing the dashboard.
                }, 1000);
            } else {
                if (!iosPermissionNeeded) addLog("Gyroscope: DeviceOrientationEvent Undefined");
            }

            // 4. Motion
            if (typeof DeviceMotionEvent !== 'undefined' && !iosPermissionNeeded) {
                const handleMotion = (e: DeviceMotionEvent) => {
                    if (!e.accelerationIncludingGravity) return;
                    sendData({
                        acceleration: {
                            x: e.accelerationIncludingGravity.x,
                            y: e.accelerationIncludingGravity.y,
                            z: e.accelerationIncludingGravity.z
                        }
                    });
                };
                window.addEventListener('devicemotion', handleMotion);
            } else {
                if (!iosPermissionNeeded) addLog("Motion: DeviceMotionEvent Undefined");
            }

        }, [status, isConnected, iosPermissionNeeded]);

        const requestIosPermission = async () => {
            if (typeof DeviceOrientationEvent !== 'undefined' && typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
                try {
                    const response = await (DeviceOrientationEvent as any).requestPermission();
                    if (response === 'granted') {
                        addLog("iOS Permission: GRANTED");
                        setIosPermissionNeeded(false);
                    } else {
                        addLog("iOS Permission: DENIED");
                    }
                } catch (e: any) {
                    addLog(`iOS Err: ${e.message}`);
                }
            }
        };

        const triggerVibrate = () => {
            if (!navigator.vibrate) {
                setVibrateStatus("Unsupported (iOS?)");
                addLog("Vibrate: API Missing (Likely iOS)");
                return;
            }
            try {
                const success = navigator.vibrate(200);
                if (success) {
                    setVibrateStatus("Buzzing!");
                    addLog("Vibrate: Triggered");
                    setTimeout(() => setVibrateStatus("Idle"), 500);
                } else {
                    setVibrateStatus("Blocked");
                    addLog("Vibrate: Browser Blocked");
                }
            } catch (e: any) {
                setVibrateStatus("Error");
                addLog(`Vibrate Err: ${e.message}`);
            }
        };

        return (
            <div className="h-full w-full flex flex-col p-6 bg-black text-white font-mono overflow-auto">
                <header className="w-full border-b border-gray-800 pb-4 mb-6">
                    <h1 className="text-xl font-bold text-teal-400">SENSOR PROBE</h1>
                    <div className="flex justify-between items-center text-xs mt-2">
                        <span className={isConnected ? "text-green-400" : "text-red-400"}>
                            {isConnected ? "● ONLINE" : "○ SEARCHING"}
                        </span>
                        <span className="text-gray-600">v4.5 (SHARED)</span>
                    </div>
                </header>

                <div className="space-y-6">
                    {/* iOS Permission Button (Conditional) */}
                    {iosPermissionNeeded && (
                        <button
                            onClick={requestIosPermission}
                            className="w-full py-4 bg-blue-500 text-white font-bold rounded animate-pulse"
                        >
                            ENABLE MOTION SENSORS
                        </button>
                    )}

                    {/* Touch Forensics */}
                    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                        <h3 className="text-xs text-gray-500 mb-2 tracking-widest">TOUCH FORENSICS</h3>
                        <div
                            className="w-full h-32 bg-gray-800/50 rounded flex flex-col items-center justify-center relative overflow-hidden active:bg-gray-800 transition-colors"
                            onTouchStart={(e) => {
                                handleTouchTest(e);
                                addLog("Touch Active");
                            }}
                            onTouchMove={handleTouchTest}
                            onTouchEnd={() => addLog("Touch Released")}
                        >
                            <div className="absolute inset-0 flex flex-col justify-center items-center pointer-events-none">
                                <span className="text-xs text-gray-400">Scan Fingerprint Here</span>
                            </div>
                        </div>
                        <p className="text-[10px] text-gray-600 mt-2">
                            Transmits Force, Radius, and Angle to Desktop.
                        </p>
                    </div>

                    {/* Vibration Test */}
                    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                        <h3 className="text-xs text-gray-500 mb-3 tracking-widest">HAPTICS</h3>
                        <button
                            onClick={triggerVibrate}
                            className={`w-full py-4 border rounded font-bold transition-all ${vibrateStatus === "Buzzing!"
                                ? "bg-teal-500 text-black border-teal-500 scale-95"
                                : "bg-transparent text-teal-400 border-teal-500/50 hover:bg-teal-500/10"
                                }`}
                        >
                            {vibrateStatus === "Idle" ? "TEST VIBRATION 200ms" : vibrateStatus}
                        </button>
                    </div>

                    {/* Logs Console */}
                    <div className="bg-black border border-gray-800 rounded-lg p-4 font-mono text-[10px] h-48 overflow-y-auto">
                        <h3 className="text-xs text-gray-500 mb-2 border-b border-gray-800 pb-1">SYSTEM LOG</h3>
                        <div className="flex flex-col gap-2">
                            {logs.length === 0 && <span className="text-gray-700 italic">...system idle...</span>}
                            {logs.map((log, i) => (
                                <span key={i} className="text-teal-500/80 border-b border-gray-900/50 pb-1">
                                    {log}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="p-4 bg-yellow-900/20 border border-yellow-700/30 rounded text-[10px] text-yellow-500/80">
                        <p className="font-bold mb-1">🔓 "HACK" FOR SENSORS:</p>
                        <p>To force enable Gyro/Motion on Local WiFi:</p>
                        <ol className="list-decimal pl-4 mt-1 space-y-1 opacity-80">
                            <li>Open Chrome on Phone</li>
                            <li>Go to: <span className="text-white select-all">chrome://flags</span></li>
                            <li>Search: <span className="text-white">"insecure origins"</span></li>
                            <li>Add your IP: <span className="text-white select-all">{origin}</span></li>
                            <li>Set to <b>Enabled</b> & Relaunch</li>
                        </ol>
                    </div>
                </div>
            </div>
        );
    }

    // --- HYPER VISUALS MODE ---
    if (modeParam === 'hyper') {
        return (
            <div className="h-full w-full flex flex-col items-center justify-between p-8 bg-black text-teal-400 font-mono touch-none select-none overscroll-none">
                <style jsx global>{`
                    html, body { overflow: hidden; position: fixed; width: 100%; height: 100%; }
                `}</style>

                <div className="w-full flex justify-between items-center bg-teal-900/20 p-4 rounded-lg border border-teal-500/30">
                    <h1 className="text-xl font-bold tracking-widest">SYSTEM_CORE</h1>
                    <div className={`w-3 h-3 rounded-sm ${isConnected ? 'bg-teal-400 animate-pulse' : 'bg-red-500'}`} />
                </div>

                <div className="flex-1 w-full flex flex-col justify-center items-center gap-8 py-8">
                    {/* CUSTOM TOUCH SLIDER */}
                    <div
                        ref={sliderRef}
                        className="relative h-full w-24 bg-gray-900 rounded-full border-2 border-gray-700 overflow-hidden active:border-teal-400 transition-colors"
                        onTouchStart={handleSliderTouch}
                        onTouchMove={handleSliderTouch}
                    >
                        {/* Fill Bar */}
                        <div
                            className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-teal-900 via-teal-500 to-white transition-transform duration-75 ease-linear will-change-transform"
                            style={{
                                height: '100%',
                                transform: `translateY(${(1 - intensity) * 100}%)`
                            }}
                        />

                        {/* Thumb / Indicator */}
                        <div
                            className="absolute left-0 right-0 h-1 bg-white shadow-[0_0_10px_white]"
                            style={{
                                bottom: `${intensity * 100}%`,
                                transition: 'bottom 0.075s linear'
                            }}
                        />

                        {/* Decor Lines */}
                        <div className="absolute inset-0 flex flex-col justify-between py-4 pointer-events-none opacity-20">
                            {[...Array(10)].map((_, i) => (
                                <div key={i} className="w-full h-px bg-teal-500" />
                            ))}
                        </div>
                    </div>

                    <p className="text-xs uppercase tracking-widest text-teal-600 font-bold">
                        Instability: {(intensity * 100).toFixed(0)}%
                    </p>
                </div>

                <button
                    onTouchStart={() => toggleGlitch(true)}
                    onMouseDown={() => toggleGlitch(true)}
                    onTouchEnd={() => toggleGlitch(false)}
                    onMouseUp={() => toggleGlitch(false)}
                    className="w-full py-6 bg-red-500/10 border border-red-500 text-red-500 font-bold tracking-[0.2em] rounded-sm active:bg-red-500 active:text-black transition-colors"
                >
                    PURGE CACHE
                </button>
            </div>
        );
    }

    // --- CLAY MODE HANDLERS ---
    // Absolute positioning: Track the container reference
    const clayAreaRef = useRef<HTMLDivElement>(null);

    const handleClayInput = (e: React.TouchEvent | React.MouseEvent) => {
        // Prevent default only for touch events to stop scrolling
        if ((e as any).type.startsWith('touch')) {
            // e.preventDefault(); // Commenting out to allow some UI interaction if needed, but usually good to block
        }

        if (!connRef.current || !connRef.current.open || !clayAreaRef.current) return;

        let clientX, clientY, force = 0.5, radius = 20;

        if ((e as any).touches && (e as any).touches.length > 0) {
            const t = (e as any).touches[0];
            clientX = t.clientX;
            clientY = t.clientY;
            force = t.force || 0.5;
            radius = t.radiusX || 20;
        } else {
            // Mouse fallback
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
            if ((e as React.MouseEvent).buttons === 1) force = 1.0;
        }

        const rect = clayAreaRef.current.getBoundingClientRect();

        // Safety against 0-width (unlikely but fatal)
        const width = rect.width > 0 ? rect.width : 1;
        const height = rect.height > 0 ? rect.height : 1;

        // Normalize 0 to 1
        const x = (clientX - rect.left) / width;
        const y = (clientY - rect.top) / height;

        // Clamp 0-1
        const cleanX = Math.max(0, Math.min(1, x));
        const cleanY = Math.max(0, Math.min(1, y));

        // Update Debug UI
        const debugEl = document.getElementById('debug-clay');
        if (debugEl) {
            debugEl.innerText = `X:${cleanX.toFixed(2)} Y:${cleanY.toFixed(2)} F:${force.toFixed(2)}`;
        }

        // Read Force Multiplier from slider
        const sliderEl = document.getElementById('force-multiplier') as HTMLInputElement;
        const forceMultiplier = sliderEl ? parseFloat(sliderEl.value) : 1.0;

        // Update slider value display
        const forceValueEl = document.getElementById('force-value');
        if (forceValueEl) forceValueEl.innerText = `${forceMultiplier.toFixed(1)}x`;

        const payload = {
            x: cleanX,
            y: cleanY,
            force: force * forceMultiplier,
            radius: radius
        };

        // TX Log
        // console.log("TX:", payload); // Spammy

        connRef.current.send({ type: 'CLAY_INPUT', payload });
    };

    // Touch End Handler - Send zero force to stop sculpting
    const handleClayTouchEnd = () => {
        if (!connRef.current) return;
        connRef.current.send({
            type: 'CLAY_INPUT',
            payload: { x: 0.5, y: 0.5, force: 0, radius: 0 }
        });
        const debugEl = document.getElementById('debug-clay');
        if (debugEl) debugEl.innerText = `RELEASED`;
    };

    // --- CLAY MODE ---
    if (modeParam === 'clay') {
        return (
            <div
                className="h-full w-full bg-stone-900 text-stone-200 font-mono touch-none select-none flex flex-col"
            >
                {/* Header with Force Slider */}
                <div className="p-4 border-b border-stone-700 space-y-2">
                    <div className="flex justify-between items-center">
                        <h1 className="text-xl font-bold text-stone-400">SCULPT_TOOL</h1>
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                    </div>

                    {/* Force Multiplier Slider */}
                    <div className="flex items-center gap-3 pointer-events-auto">
                        <span className="text-xs text-stone-500 w-16">FORCE:</span>
                        <input
                            type="range"
                            min="0.1"
                            max="3"
                            step="0.1"
                            defaultValue="1"
                            id="force-multiplier"
                            className="flex-1 h-2 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                        />
                        <span className="text-xs text-amber-400 w-8" id="force-value">1.0x</span>
                    </div>
                </div>

                {/* Touch Area - Visual Rectangle Mapping to Mesh */}
                <div className="flex-1 flex flex-col items-center justify-center p-2 relative overflow-hidden">
                    {/* The main touch zone - maps 1:1 to the mesh */}
                    <div
                        id="clay-touch-zone"
                        ref={clayAreaRef}
                        className="relative w-full aspect-square max-w-[85vw] border-2 border-amber-500/60 rounded-lg bg-stone-800/40"
                        onTouchStart={handleClayInput}
                        onTouchMove={(e) => { e.preventDefault(); handleClayInput(e); }}
                        onTouchEnd={handleClayTouchEnd}
                        onTouchCancel={handleClayTouchEnd}
                    >
                        {/* Corner markers - flush to corners */}
                        <div className="absolute top-0 left-0 w-4 h-4 border-l-2 border-t-2 border-amber-500" />
                        <div className="absolute top-0 right-0 w-4 h-4 border-r-2 border-t-2 border-amber-500" />
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-l-2 border-b-2 border-amber-500" />
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-r-2 border-b-2 border-amber-500" />

                        {/* Center crosshair */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-6 h-[1px] bg-amber-500/30" />
                            <div className="absolute w-[1px] h-6 bg-amber-500/30" />
                        </div>

                        {/* Instructions */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <p className="text-[11px] text-stone-400 text-center">
                                TOUCH TO SCULPT
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-2 bg-stone-950 text-[9px] text-center text-stone-600">
                    SCULPT MODE · DIRECT BUFFER
                </div>
            </div>
        );
    }

    // --- CLOUDS MODE (Touch the Clouds) ---
    if (modeParam === 'clouds') {
        const [calibrationState, setCalibrationState] = useState<'waiting' | 'countdown' | 'active'>('waiting');
        const [countdown, setCountdown] = useState(5);
        const [wandPosition, setWandPosition] = useState({ x: 0, y: 0, z: 0 });

        // Velocity and position tracking for sensor fusion
        const velocityRef = useRef({ x: 0, y: 0, z: 0 });
        const positionRef = useRef({ x: 0, y: 0, z: 0 });
        const lastTimeRef = useRef(0);
        const gravityRef = useRef({ x: 0, y: 0, z: 9.8 });

        // Start calibration countdown
        const startCalibration = () => {
            setCalibrationState('countdown');
            setCountdown(5);
        };

        // Countdown effect
        useEffect(() => {
            if (calibrationState !== 'countdown') return;

            if (countdown > 0) {
                const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
                return () => clearTimeout(timer);
            } else {
                // Calibration complete - capture gravity baseline
                setCalibrationState('active');
                positionRef.current = { x: 0, y: 0, z: 0 };
                velocityRef.current = { x: 0, y: 0, z: 0 };

                // Send calibrated state
                if (connRef.current && connRef.current.open) {
                    connRef.current.send({
                        type: 'WAND_POSITION',
                        payload: { x: 0, y: 0, z: 0, calibrated: true }
                    });
                }
            }
        }, [calibrationState, countdown]);

        // Sensor fusion - process accelerometer and gyro data
        useEffect(() => {
            if (calibrationState !== 'active') return;
            if (!connRef.current || !connRef.current.open) return;

            let animationId: number;
            const damping = 0.92; // Velocity damping to reduce drift
            const sensitivity = 0.002; // Position sensitivity
            const maxPosition = 1.0; // Clamp to -1 to 1

            const handleMotion = (e: DeviceMotionEvent) => {
                const now = performance.now();
                const dt = lastTimeRef.current ? (now - lastTimeRef.current) / 1000 : 0.016;
                lastTimeRef.current = now;

                if (!e.accelerationIncludingGravity) return;

                const ax = e.accelerationIncludingGravity.x || 0;
                const ay = e.accelerationIncludingGravity.y || 0;
                const az = e.accelerationIncludingGravity.z || 0;

                // Subtract estimated gravity (phone flat = z points up = -9.8)
                // When phone tilts, distribute gravity across axes
                const netX = ax;
                const netY = ay;
                const netZ = az - 9.8; // Subtract gravity for forward/back movement

                // Update velocity with damping
                velocityRef.current.x = (velocityRef.current.x + netX * dt) * damping;
                velocityRef.current.y = (velocityRef.current.y + netY * dt) * damping;
                velocityRef.current.z = (velocityRef.current.z + netZ * dt) * damping;

                // Stillness detection - reset velocity when nearly still
                const accelMag = Math.sqrt(ax * ax + ay * ay + az * az);
                if (Math.abs(accelMag - 9.8) < 0.5) {
                    velocityRef.current.x *= 0.8;
                    velocityRef.current.y *= 0.8;
                    velocityRef.current.z *= 0.8;
                }

                // Update position
                positionRef.current.x += velocityRef.current.x * sensitivity;
                positionRef.current.y += velocityRef.current.y * sensitivity;
                positionRef.current.z += velocityRef.current.z * sensitivity;

                // Clamp position
                positionRef.current.x = Math.max(-maxPosition, Math.min(maxPosition, positionRef.current.x));
                positionRef.current.y = Math.max(-maxPosition, Math.min(maxPosition, positionRef.current.y));
                positionRef.current.z = Math.max(0, Math.min(maxPosition, positionRef.current.z)); // Z only forward

                // Update local state for visualization
                setWandPosition({ ...positionRef.current });

                // Send to desktop
                connRef.current?.send({
                    type: 'WAND_POSITION',
                    payload: {
                        x: positionRef.current.x,
                        y: positionRef.current.y,
                        z: positionRef.current.z,
                        calibrated: true
                    }
                });
            };

            window.addEventListener('devicemotion', handleMotion);
            return () => window.removeEventListener('devicemotion', handleMotion);
        }, [calibrationState, isConnected]);

        // Request iOS permission if needed
        const requestPermission = async () => {
            if (typeof DeviceMotionEvent !== 'undefined' &&
                typeof (DeviceMotionEvent as any).requestPermission === 'function') {
                try {
                    const response = await (DeviceMotionEvent as any).requestPermission();
                    if (response === 'granted') {
                        startCalibration();
                    }
                } catch (e) {
                    console.error('Permission denied:', e);
                }
            } else {
                startCalibration();
            }
        };

        return (
            <div className="h-full w-full bg-gradient-to-b from-blue-950 to-gray-900 text-white font-mono flex flex-col touch-none select-none overflow-hidden">
                {/* Header */}
                <div className="p-4 flex justify-between items-center">
                    <h1 className="text-lg font-bold text-blue-300">CLOUD_WAND</h1>
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col items-center justify-center p-6">
                    {/* Waiting State */}
                    {calibrationState === 'waiting' && (
                        <div className="text-center space-y-6">
                            <div className="text-6xl">☁️</div>
                            <h2 className="text-xl font-bold text-blue-200">Position Your Phone</h2>
                            <p className="text-sm text-blue-400/70 max-w-[250px]">
                                Hold phone flat at arm's length, facing the screen.
                            </p>
                            <div className="w-32 h-20 border-2 border-dashed border-blue-500/50 rounded-lg flex items-center justify-center mx-auto">
                                <span className="text-2xl">📱</span>
                            </div>
                            <button
                                onClick={requestPermission}
                                disabled={!isConnected}
                                className={`px-8 py-4 rounded-xl font-bold text-lg transition-all ${isConnected
                                        ? 'bg-blue-500 hover:bg-blue-400 active:scale-95'
                                        : 'bg-gray-600 cursor-not-allowed'
                                    }`}
                            >
                                {isConnected ? 'CALIBRATE' : 'WAITING FOR CONNECTION'}
                            </button>
                        </div>
                    )}

                    {/* Countdown State */}
                    {calibrationState === 'countdown' && (
                        <div className="text-center space-y-4">
                            <p className="text-sm text-blue-400 uppercase tracking-widest">Hold Still</p>
                            <div className="text-9xl font-bold text-blue-300 animate-pulse">
                                {countdown}
                            </div>
                            <p className="text-xs text-blue-500/70">Calibrating sensors...</p>
                        </div>
                    )}

                    {/* Active Wand Mode */}
                    {calibrationState === 'active' && (
                        <div className="relative w-full h-full flex flex-col items-center justify-center">
                            {/* Wand Visualization */}
                            <div className="relative w-48 h-48">
                                {/* Outer ring */}
                                <div className="absolute inset-0 border-2 border-blue-500/30 rounded-full" />

                                {/* Position indicator */}
                                <div
                                    className="absolute w-6 h-6 bg-blue-400 rounded-full shadow-[0_0_20px_#3b82f6] transition-transform duration-75"
                                    style={{
                                        left: `calc(50% + ${wandPosition.x * 80}px - 12px)`,
                                        top: `calc(50% - ${wandPosition.y * 80}px - 12px)`,
                                        transform: `scale(${1 + wandPosition.z * 0.5})`,
                                    }}
                                />

                                {/* Center crosshair */}
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="w-px h-8 bg-blue-500/30" />
                                    <div className="absolute w-8 h-px bg-blue-500/30" />
                                </div>
                            </div>

                            {/* Z Depth Bar */}
                            <div className="mt-8 w-48 space-y-1">
                                <div className="flex justify-between text-[10px] text-blue-400/70">
                                    <span>DEPTH</span>
                                    <span>{(wandPosition.z * 100).toFixed(0)}%</span>
                                </div>
                                <div className="h-2 bg-blue-900/50 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-75"
                                        style={{ width: `${wandPosition.z * 100}%` }}
                                    />
                                </div>
                            </div>

                            <p className="mt-6 text-xs text-blue-400/50 text-center">
                                MOVE TO PART CLOUDS · PUSH FORWARD TO REVEAL
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 bg-blue-950/50 text-[10px] text-center text-blue-500/50">
                    {calibrationState === 'active' ? 'WAND ACTIVE · MOVE FREELY' : 'TOUCH THE CLOUDS · v07'}
                </div>
            </div>
        );
    }

    // Default Cube/Gravity Interface
    return (
        <div
            className="h-full w-full flex flex-col items-center justify-between p-6 bg-gray-900 text-white touch-none"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
        >
            <div className="w-full flex justify-between items-center pointer-events-none select-none">
                <h1 className="text-xl font-bold tracking-tighter">CONTROLLER</h1>
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_10px_#00ff00]' : 'bg-red-500'}`} />
            </div>

            <div className="flex-1 w-full flex items-center justify-center pointer-events-none select-none opacity-20">
                <div className="w-24 h-24 border-2 border-white rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full" />
                </div>
                <p className="absolute mt-32 text-xs uppercase tracking-widest">Touch & Drag</p>
            </div>

            <div className="w-full grid grid-cols-4 gap-4 mb-8" onTouchStart={(e) => e.stopPropagation()}>
                <button onClick={() => sendColor('#ef4444')} className="aspect-square rounded-xl bg-red-500 shadow-lg active:scale-90 transition-transform" />
                <button onClick={() => sendColor('#3b82f6')} className="aspect-square rounded-xl bg-blue-500 shadow-lg active:scale-90 transition-transform" />
                <button onClick={() => sendColor('#22c55e')} className="aspect-square rounded-xl bg-green-500 shadow-lg active:scale-90 transition-transform" />
                <button onClick={() => sendColor('#eab308')} className="aspect-square rounded-xl bg-yellow-500 shadow-lg active:scale-90 transition-transform" />
            </div>
        </div>
    );
}

export default function MobilePage() {
    return (
        <Suspense fallback={<div className="text-white text-center p-10">Initializing...</div>}>
            <MobileControllerContent />
        </Suspense>
    );
}
