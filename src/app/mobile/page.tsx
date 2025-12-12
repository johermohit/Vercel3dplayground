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

    // --- CLOUDS MODE (Touch the Clouds) - Orientation-based tracking ---
    if (modeParam === 'clouds') {
        const [calibrationState, setCalibrationState] = useState<'waiting' | 'countdown' | 'active'>('waiting');
        const [countdown, setCountdown] = useState(5);
        const [wandPosition, setWandPosition] = useState({ x: 0, y: 0, z: 0 });

        // Calibration baseline (captured at end of countdown)
        const baselineRef = useRef({ beta: 0, gamma: 0 });

        // Virtual box dimensions (normalized -1 to 1)
        const maxTiltX = 30; // degrees of gamma (left/right tilt)
        const maxTiltY = 30; // degrees of beta (forward/back tilt)
        const maxPushZ = 40; // degrees of beta to reach max Z

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
                // Calibration complete - next orientation reading becomes baseline
                setCalibrationState('active');

                // Send calibrated state
                if (connRef.current && connRef.current.open) {
                    connRef.current.send({
                        type: 'WAND_POSITION',
                        payload: { x: 0, y: 0, z: 0, calibrated: true }
                    });
                }
            }
        }, [calibrationState, countdown]);

        // Orientation-based tracking (AR/VR style)
        useEffect(() => {
            if (calibrationState !== 'active') return;
            if (!connRef.current || !connRef.current.open) return;

            let baselineCaptured = false;

            const handleOrientation = (e: DeviceOrientationEvent) => {
                if (e.beta === null || e.gamma === null) return;

                const beta = e.beta; // -180 to 180 (pitch: tilt forward/back)
                const gamma = e.gamma; // -90 to 90 (roll: tilt left/right)

                // Capture baseline on first reading after calibration
                if (!baselineCaptured) {
                    baselineRef.current = { beta, gamma };
                    baselineCaptured = true;
                    return;
                }

                // Calculate delta from baseline
                const deltaBeta = beta - baselineRef.current.beta;
                const deltaGamma = gamma - baselineRef.current.gamma;

                // Map gamma to X (left/right tilt)
                // Phone tilted left = negative gamma = move left
                let x = deltaGamma / maxTiltX;
                x = Math.max(-1, Math.min(1, x));

                // Map beta to Y and Z
                // For Y: small tilts = up/down
                // For Z: larger forward tilt = push forward (reveal clouds)

                // Y is for small vertical adjustments
                let y = -deltaBeta / maxTiltY; // Negative because tilt forward should go up
                y = Math.max(-1, Math.min(1, y));

                // Z is based on forward tilt (positive beta = tilted toward screen)
                // User starts with phone flat, tilts toward screen to reveal
                let z = deltaBeta / maxPushZ;
                z = Math.max(0, Math.min(1, z)); // Z only goes forward (0 to 1)

                // Spring-back effect: if at edge, gradually pull toward center
                const springStrength = 0.02;
                const edgeThreshold = 0.95;

                if (Math.abs(x) > edgeThreshold) {
                    x *= (1 - springStrength);
                }
                if (Math.abs(y) > edgeThreshold) {
                    y *= (1 - springStrength);
                }

                // Update local state for visualization
                setWandPosition({ x, y, z });

                // Send to desktop
                connRef.current?.send({
                    type: 'WAND_POSITION',
                    payload: { x, y, z, calibrated: true }
                });
            };

            window.addEventListener('deviceorientation', handleOrientation);
            return () => window.removeEventListener('deviceorientation', handleOrientation);
        }, [calibrationState, isConnected]);

        // Request iOS permission if needed
        const requestPermission = async () => {
            if (typeof DeviceOrientationEvent !== 'undefined' &&
                typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
                try {
                    const response = await (DeviceOrientationEvent as any).requestPermission();
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
            <div className="h-full w-full bg-gradient-to-b from-sky-900 via-blue-950 to-gray-900 text-white font-mono flex flex-col touch-none select-none overflow-hidden">
                {/* Header */}
                <div className="p-4 flex justify-between items-center border-b border-white/10">
                    <h1 className="text-lg font-bold text-sky-300">☁️ CLOUD WAND</h1>
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-red-500'}`} />
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col items-center justify-center p-6">
                    {/* Waiting State */}
                    {calibrationState === 'waiting' && (
                        <div className="text-center space-y-6">
                            <div className="text-7xl">☁️</div>
                            <h2 className="text-xl font-bold text-sky-200">Position Your Phone</h2>
                            <p className="text-sm text-sky-400/70 max-w-[260px] leading-relaxed">
                                Hold phone <strong>flat</strong> in front of you, screen facing up,
                                at arm's length toward the screen.
                            </p>
                            <div className="relative w-40 h-24 border-2 border-dashed border-sky-500/50 rounded-lg flex items-center justify-center mx-auto">
                                <span className="text-3xl">📱</span>
                                <div className="absolute -bottom-8 text-[10px] text-sky-500/60">SCREEN UP · FACING MONITOR</div>
                            </div>
                            <button
                                onClick={requestPermission}
                                disabled={!isConnected}
                                className={`mt-4 px-10 py-4 rounded-xl font-bold text-lg transition-all shadow-lg ${isConnected
                                        ? 'bg-sky-500 hover:bg-sky-400 active:scale-95 shadow-sky-500/30'
                                        : 'bg-gray-600 cursor-not-allowed'
                                    }`}
                            >
                                {isConnected ? 'START CALIBRATION' : 'WAITING FOR CONNECTION'}
                            </button>
                        </div>
                    )}

                    {/* Countdown State */}
                    {calibrationState === 'countdown' && (
                        <div className="text-center space-y-4">
                            <p className="text-sm text-sky-400 uppercase tracking-[0.3em]">Hold Perfectly Still</p>
                            <div className="text-[10rem] font-bold text-sky-300 leading-none animate-pulse">
                                {countdown}
                            </div>
                            <p className="text-xs text-sky-500/70">Capturing baseline orientation...</p>
                        </div>
                    )}

                    {/* Active Wand Mode */}
                    {calibrationState === 'active' && (
                        <div className="relative w-full h-full flex flex-col items-center justify-center">
                            {/* Wand Visualization - 2D top-down view */}
                            <div className="relative w-56 h-56 mb-4">
                                {/* Outer boundary */}
                                <div className="absolute inset-0 border-2 border-sky-500/30 rounded-2xl bg-sky-900/20" />

                                {/* Grid lines */}
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="w-full h-px bg-sky-500/20" />
                                    <div className="absolute w-px h-full bg-sky-500/20" />
                                </div>

                                {/* Quadrant labels */}
                                <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[9px] text-sky-500/50">FORWARD</div>
                                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[9px] text-sky-500/50">BACK</div>
                                <div className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-sky-500/50">L</div>
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-sky-500/50">R</div>

                                {/* Position indicator with glow */}
                                <div
                                    className="absolute w-8 h-8 bg-sky-400 rounded-full shadow-[0_0_30px_#38bdf8,0_0_60px_#38bdf8] transition-all duration-100 flex items-center justify-center"
                                    style={{
                                        left: `calc(50% + ${wandPosition.x * 100}px - 16px)`,
                                        top: `calc(50% - ${wandPosition.y * 100}px - 16px)`,
                                        transform: `scale(${1 + wandPosition.z * 0.8})`,
                                        opacity: 0.8 + wandPosition.z * 0.2,
                                    }}
                                >
                                    <div className="w-2 h-2 bg-white rounded-full" />
                                </div>
                            </div>

                            {/* Z Depth Bar */}
                            <div className="w-56 space-y-2 mt-4">
                                <div className="flex justify-between text-[11px] text-sky-400/80">
                                    <span>REVEAL DEPTH</span>
                                    <span className="font-bold">{(wandPosition.z * 100).toFixed(0)}%</span>
                                </div>
                                <div className="h-3 bg-sky-900/50 rounded-full overflow-hidden border border-sky-500/20">
                                    <div
                                        className="h-full bg-gradient-to-r from-sky-600 via-sky-400 to-white transition-all duration-100 rounded-full"
                                        style={{ width: `${Math.max(5, wandPosition.z * 100)}%` }}
                                    />
                                </div>
                                <p className="text-[10px] text-sky-500/50 text-center mt-1">
                                    TILT FORWARD → REVEAL SKY
                                </p>
                            </div>

                            <p className="mt-8 text-xs text-sky-400/60 text-center max-w-[200px]">
                                Tilt phone to explore · Lean forward to part clouds
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 bg-black/30 text-[10px] text-center text-sky-500/50 border-t border-white/5">
                    {calibrationState === 'active' ? 'WAND ACTIVE · TILT TO CONTROL' : 'TOUCH THE CLOUDS · v07'}
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
