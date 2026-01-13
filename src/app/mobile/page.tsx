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

            // 5. Ambient Light Sensor
            if ('AmbientLightSensor' in window) {
                try {
                    const lightSensor = new (window as any).AmbientLightSensor();
                    lightSensor.addEventListener('reading', () => {
                        sendData({
                            light: {
                                illuminance: lightSensor.illuminance // in lux
                            }
                        });
                    });
                    lightSensor.addEventListener('error', (event: any) => {
                        addLog(`Light Err: ${event.error.name}`);
                    });
                    lightSensor.start();
                    addLog("Light Sensor: Active");
                } catch (e: any) {
                    addLog(`Light Err: ${e.message}`);
                }
            } else {
                addLog("Light Sensor: Not supported");
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

                    {/* Camera Test */}
                    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                        <h3 className="text-xs text-gray-500 mb-3 tracking-widest">CAMERA</h3>
                        <button
                            onClick={() => {
                                const url = new URL(window.location.href);
                                url.searchParams.set('mode', 'camera');
                                window.location.href = url.toString();
                            }}
                            className="w-full py-4 border rounded font-bold transition-all bg-transparent text-purple-400 border-purple-500/50 hover:bg-purple-500/10"
                        >
                            📷 OPEN CAMERA TEST
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

    // --- BLOW MODE (Microphone blow detection) ---
    if (modeParam === 'blow') {
        const [isListening, setIsListening] = useState(false);
        const [blowIntensity, setBlowIntensity] = useState(0);
        const [isBlowing, setIsBlowing] = useState(false);
        const [blowCount, setBlowCount] = useState(0);
        const [permissionStatus, setPermissionStatus] = useState<'pending' | 'granted' | 'denied'>('pending');

        const audioContextRef = useRef<AudioContext | null>(null);
        const analyserRef = useRef<AnalyserNode | null>(null);
        const streamRef = useRef<MediaStream | null>(null);
        const animationRef = useRef<number>(0);

        // Detection parameters
        const BLOW_THRESHOLD = 0.12;
        const BLOW_COOLDOWN = 200;
        const lastBlowRef = useRef(0);

        const startListening = async () => {
            try {
                // Check if mediaDevices is available (requires HTTPS or localhost)
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    setPermissionStatus('denied');
                    alert('Microphone access requires HTTPS. Make sure you\'re accessing via a secure connection.');
                    return;
                }

                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
                });

                streamRef.current = stream;
                setPermissionStatus('granted');

                const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                audioContextRef.current = audioContext;

                const analyser = audioContext.createAnalyser();
                analyser.fftSize = 256;
                analyser.smoothingTimeConstant = 0.3;
                analyserRef.current = analyser;

                const source = audioContext.createMediaStreamSource(stream);
                source.connect(analyser);

                setIsListening(true);

                const bufferLength = analyser.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);

                // SIMPLIFIED BLOW DETECTION
                // Higher thresholds, sustained duration required
                let smoothedIntensity = 0;
                let blowStartTime = 0;
                const MIN_BLOW_DURATION = 150; // Must blow for 150ms

                const analyze = () => {
                    if (!analyserRef.current) return;

                    analyserRef.current.getByteFrequencyData(dataArray);

                    // Low-frequency energy (first 5 bins ~ 0-860Hz)
                    let lowSum = 0;
                    for (let i = 0; i < 5; i++) {
                        lowSum += dataArray[i];
                    }
                    const lowAvg = lowSum / 5 / 255;

                    // High-frequency energy for ratio
                    let highSum = 0;
                    for (let i = 20; i < bufferLength; i++) {
                        highSum += dataArray[i];
                    }
                    const highAvg = highSum / (bufferLength - 20) / 255;

                    // Ratio: low should dominate high for blow
                    const ratio = lowAvg / (highAvg + 0.001);

                    // Slow smoothing to reduce noise
                    smoothedIntensity += (lowAvg - smoothedIntensity) * 0.1;
                    const intensity = Math.min(1, smoothedIntensity * 2);
                    setBlowIntensity(intensity);

                    const now = Date.now();

                    // SIMPLE CHECK: high threshold + ratio + sustained
                    const isBlowCandidate = lowAvg > 0.25 && ratio > 4.0;

                    let blowing = false;
                    if (isBlowCandidate) {
                        if (blowStartTime === 0) blowStartTime = now;
                        blowing = (now - blowStartTime) > MIN_BLOW_DURATION;
                    } else {
                        blowStartTime = 0;
                    }

                    if (blowing && !isBlowing) {
                        setBlowCount(prev => prev + 1);
                    }
                    setIsBlowing(blowing);

                    // Send to desktop
                    if (connRef.current && connRef.current.open) {
                        connRef.current.send({
                            type: 'BLOW_DATA',
                            payload: { intensity, isBlowing: blowing, timestamp: now }
                        });
                    }

                    animationRef.current = requestAnimationFrame(analyze);
                };

                analyze();

            } catch (err: any) {
                setPermissionStatus('denied');
                console.error("Mic error:", err);
            }
        };

        const stopListening = () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
            if (audioContextRef.current) audioContextRef.current.close();
            setIsListening(false);
            setBlowIntensity(0);
            setIsBlowing(false);
        };

        useEffect(() => () => stopListening(), []);

        return (
            <div className="h-full w-full bg-gradient-to-b from-cyan-950 to-gray-900 text-white font-mono flex flex-col touch-none select-none overflow-hidden">
                {/* Header */}
                <div className="p-4 flex justify-between items-center border-b border-white/10">
                    <h1 className="text-lg font-bold text-cyan-300">🎤 BLOW DETECTOR</h1>
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                </div>

                {/* Main */}
                <div className="flex-1 flex flex-col items-center justify-center p-6">
                    {!isListening ? (
                        <div className="text-center space-y-6">
                            <div className="text-8xl">🎤</div>
                            <h2 className="text-xl font-bold text-cyan-200">Microphone Access</h2>
                            <p className="text-sm text-cyan-400/70 max-w-[250px]">
                                Tap to enable mic and start detecting your breath.
                            </p>
                            <button
                                onClick={startListening}
                                disabled={!isConnected}
                                className={`px-10 py-4 rounded-xl font-bold text-lg transition-all ${isConnected
                                    ? 'bg-cyan-500 hover:bg-cyan-400 active:scale-95'
                                    : 'bg-gray-600 cursor-not-allowed'
                                    }`}
                            >
                                {isConnected ? 'START LISTENING' : 'WAITING FOR CONNECTION'}
                            </button>
                            {permissionStatus === 'denied' && (
                                <div className="text-center space-y-1">
                                    <p className="text-red-400 text-xs">Microphone access failed</p>
                                    <p className="text-yellow-400/70 text-[10px]">
                                        Mic requires HTTPS. Use Vercel deployment or ngrok for testing.
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="w-full max-w-xs space-y-8">
                            {/* Blow indicator */}
                            <div className="text-center">
                                <div className={`text-9xl transition-transform ${isBlowing ? 'scale-125' : 'scale-100'}`}>
                                    {isBlowing ? '💨' : '🎤'}
                                </div>
                                <p className={`text-sm mt-4 ${isBlowing ? 'text-cyan-400' : 'text-gray-500'}`}>
                                    {isBlowing ? 'BLOWING!' : 'Blow on mic...'}
                                </p>
                            </div>

                            {/* Intensity meter */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs text-cyan-400/70">
                                    <span>INTENSITY</span>
                                    <span className="font-bold">{Math.round(blowIntensity * 100)}%</span>
                                </div>
                                <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full transition-all duration-75 rounded-full ${isBlowing ? 'bg-gradient-to-r from-cyan-500 to-blue-400' : 'bg-gray-600'
                                            }`}
                                        style={{ width: `${blowIntensity * 100}%` }}
                                    />
                                </div>
                            </div>

                            {/* Count */}
                            <div className="text-center">
                                <div className="text-5xl font-bold text-cyan-400">{blowCount}</div>
                                <div className="text-xs text-gray-500 mt-1">BLOWS DETECTED</div>
                            </div>

                            {/* Stop button */}
                            <button
                                onClick={stopListening}
                                className="w-full py-3 bg-red-600/80 hover:bg-red-500 rounded-xl font-bold transition-colors"
                            >
                                STOP
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 bg-black/30 text-[10px] text-center text-cyan-500/50 border-t border-white/5">
                    {isListening ? 'LISTENING · BLOW ON MIC' : 'BLOW DETECTOR · v08'}
                </div>
            </div>
        );
    }

    // --- SHADER STREAMING MODE (Stream video to desktop for GPU effects) ---
    if (modeParam === 'shader') {
        const [stream, setStream] = useState<MediaStream | null>(null);
        const [isStreaming, setIsStreaming] = useState(false);
        const [activeCamera, setActiveCamera] = useState<'user' | 'environment'>('environment');
        const [error, setError] = useState<string | null>(null);
        const videoRef = useRef<HTMLVideoElement>(null);
        const peerRef = useRef<any>(null);

        const startStreaming = async (facing: 'user' | 'environment') => {
            try {
                // Stop existing stream
                if (stream) {
                    stream.getTracks().forEach(t => t.stop());
                }

                const newStream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: facing,
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    },
                    audio: false
                });

                setStream(newStream);
                setActiveCamera(facing);

                if (videoRef.current) {
                    videoRef.current.srcObject = newStream;
                }

                // Create peer connection to stream video
                const { Peer } = await import('peerjs');
                const sessionId = useConnectionStore.getState().sessionId;

                if (peerRef.current) {
                    peerRef.current.destroy();
                }

                const peer = new Peer();
                peerRef.current = peer;

                peer.on('open', (id) => {
                    console.log('[ShaderMobile] Peer open, calling desktop...');
                    // Call the desktop's video host
                    const call = peer.call(`${sessionId}-video-host`, newStream);

                    call.on('stream', () => {
                        console.log('[ShaderMobile] Stream established!');
                        setIsStreaming(true);
                    });

                    call.on('error', (err) => {
                        console.error('[ShaderMobile] Call error:', err);
                        setError('Stream error: ' + err.message);
                    });

                    // Also notify via data channel
                    if (connRef.current?.open) {
                        connRef.current.send({
                            type: 'SHADER_STREAM_START',
                            payload: { facing, peerId: id }
                        });
                    }
                });

                peer.on('error', (err) => {
                    console.error('[ShaderMobile] Peer error:', err);
                    setError('Connection error');
                });

                setIsStreaming(true);
            } catch (e: any) {
                setError(e.message);
                console.error('[ShaderMobile] Error:', e);
            }
        };

        const stopStreaming = () => {
            if (stream) {
                stream.getTracks().forEach(t => t.stop());
                setStream(null);
            }
            if (peerRef.current) {
                peerRef.current.destroy();
                peerRef.current = null;
            }
            setIsStreaming(false);

            if (connRef.current?.open) {
                connRef.current.send({
                    type: 'SHADER_STREAM_STOP',
                    payload: {}
                });
            }
        };

        // Cleanup on unmount
        useEffect(() => {
            return () => {
                if (stream) stream.getTracks().forEach(t => t.stop());
                if (peerRef.current) peerRef.current.destroy();
            };
        }, []);

        return (
            <div className="h-full w-full bg-black text-white font-mono flex flex-col">
                {/* Header */}
                <div className="p-4 flex justify-between items-center border-b border-white/10 bg-gradient-to-r from-purple-900/50 to-pink-900/50">
                    <h1 className="text-lg font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                        📹 SHADER STREAM
                    </h1>
                    <div className="flex items-center gap-2">
                        {isStreaming && <span className="text-xs text-green-400 animate-pulse">LIVE</span>}
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                    </div>
                </div>

                {/* Video Preview */}
                <div className="flex-1 relative">
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                        style={{ transform: activeCamera === 'user' ? 'scaleX(-1)' : 'none' }}
                    />

                    {!isStreaming && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                            <div className="text-center">
                                <div className="text-5xl mb-4">📹</div>
                                <div className="text-gray-400">Tap to start streaming</div>
                            </div>
                        </div>
                    )}

                    {isStreaming && (
                        <div className="absolute top-3 left-3 px-3 py-1 bg-red-500/90 rounded-full text-xs font-bold flex items-center gap-2">
                            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                            STREAMING TO DESKTOP
                        </div>
                    )}

                    {error && (
                        <div className="absolute bottom-3 left-3 right-3 p-2 bg-red-500/80 rounded text-xs">
                            ⚠️ {error}
                        </div>
                    )}
                </div>

                {/* Controls */}
                <div className="p-4 bg-gray-900 space-y-3">
                    {/* Camera selection */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => startStreaming('environment')}
                            className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${activeCamera === 'environment' && isStreaming
                                    ? 'bg-purple-600 shadow-lg shadow-purple-500/30'
                                    : 'bg-gray-700 hover:bg-gray-600'
                                }`}
                        >
                            🔙 BACK CAM
                        </button>
                        <button
                            onClick={() => startStreaming('user')}
                            className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${activeCamera === 'user' && isStreaming
                                    ? 'bg-purple-600 shadow-lg shadow-purple-500/30'
                                    : 'bg-gray-700 hover:bg-gray-600'
                                }`}
                        >
                            🤳 FRONT CAM
                        </button>
                    </div>

                    {/* Main action */}
                    <button
                        onClick={isStreaming ? stopStreaming : () => startStreaming(activeCamera)}
                        className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${isStreaming
                                ? 'bg-gradient-to-r from-red-600 to-pink-600 shadow-lg shadow-red-500/30'
                                : 'bg-gradient-to-r from-purple-600 to-pink-600 shadow-lg shadow-purple-500/30'
                            }`}
                    >
                        {isStreaming ? '⏹ STOP STREAMING' : '▶ START STREAMING'}
                    </button>
                </div>

                {/* Footer */}
                <div className="p-2 bg-black/50 text-[10px] text-center text-purple-400/50 border-t border-white/5">
                    VIDEO STREAMS TO DESKTOP FOR GPU SHADER EFFECTS
                </div>
            </div>
        );
    }

    // --- LIGHT SWITCH MODE (Phone as light sensor) ---
    if (modeParam === 'lightswitch') {
        const [brightness, setBrightness] = useState(1);
        const [isActive, setIsActive] = useState(false);
        const [error, setError] = useState<string | null>(null);
        const videoRef = useRef<HTMLVideoElement>(null);
        const canvasRef = useRef<HTMLCanvasElement>(null);
        const streamRef = useRef<MediaStream | null>(null);
        const analysisRef = useRef<number>(0);

        // Auto-start front camera on mount
        useEffect(() => {
            const startSensor = async () => {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } },
                        audio: false
                    });
                    streamRef.current = stream;
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                        // Wait for video to actually start playing
                        videoRef.current.onloadeddata = () => {
                            console.log('[LightSwitch] Video loaded, starting analysis');
                            setIsActive(true);
                        };
                        // Also try to play explicitly
                        videoRef.current.play().catch(e => console.log('[LightSwitch] Autoplay error:', e));
                    }
                } catch (e: any) {
                    setError(e.message);
                    console.error('[LightSwitch] Camera error:', e);
                }
            };
            startSensor();

            return () => {
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach(t => t.stop());
                }
                if (analysisRef.current) {
                    cancelAnimationFrame(analysisRef.current);
                }
            };
        }, []);

        // Continuous brightness analysis
        useEffect(() => {
            if (!isActive || !videoRef.current || !canvasRef.current) {
                console.log('[LightSwitch] Analysis waiting:', { isActive, hasVideo: !!videoRef.current, hasCanvas: !!canvasRef.current });
                return;
            }

            console.log('[LightSwitch] Starting analysis loop');
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            let lastSendTime = 0;
            let frameCount = 0;
            const SEND_INTERVAL = 50; // Very fast updates for responsive light

            const analyzeLoop = () => {
                if (video.readyState >= video.HAVE_CURRENT_DATA) {
                    canvas.width = 32;  // Very low res for speed
                    canvas.height = 24;
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const data = imageData.data;

                    let totalBrightness = 0;
                    let count = 0;

                    for (let i = 0; i < data.length; i += 4) {
                        const r = data[i], g = data[i + 1], b = data[i + 2];
                        totalBrightness += (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                        count++;
                    }

                    const avgBrightness = totalBrightness / count;
                    setBrightness(avgBrightness);

                    // Debug log every 60 frames
                    frameCount++;
                    if (frameCount % 60 === 0) {
                        console.log('[LightSwitch] Brightness:', avgBrightness.toFixed(2), 'Connected:', connRef.current?.open);
                    }

                    // Send to desktop
                    const now = Date.now();
                    if (now - lastSendTime > SEND_INTERVAL && connRef.current?.open) {
                        connRef.current.send({
                            type: 'FRAME_ANALYSIS',
                            payload: {
                                avgColor: { r: 0, g: 0, b: 0 }, // Not needed for light switch
                                brightness: avgBrightness,
                                colorName: avgBrightness < 0.3 ? 'Dark' : avgBrightness < 0.7 ? 'Medium' : 'Bright',
                                timestamp: now
                            }
                        });
                        lastSendTime = now;
                    }
                }

                analysisRef.current = requestAnimationFrame(analyzeLoop);
            };

            analyzeLoop();

            return () => {
                if (analysisRef.current) cancelAnimationFrame(analysisRef.current);
            };
        }, [isActive]);

        const isLightOn = brightness < 0.3;

        return (
            <div className={`h-full w-full flex flex-col items-center justify-center transition-colors duration-300 ${isLightOn
                ? 'bg-gradient-to-b from-amber-900 via-amber-950 to-black'
                : 'bg-gradient-to-b from-gray-900 to-black'
                }`}>
                {/* Hidden video and canvas - positioned off-screen, NOT display:none */}
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px' }}
                />
                <canvas ref={canvasRef} style={{ position: 'absolute', left: '-9999px' }} />

                {/* Visual feedback */}
                <div className="text-center">
                    <div className={`text-8xl mb-8 transition-all duration-300 ${isLightOn ? 'scale-110' : 'scale-100 opacity-50'}`}>
                        {isLightOn ? '💡' : '🌙'}
                    </div>

                    <div className={`text-3xl font-bold mb-4 ${isLightOn ? 'text-amber-300' : 'text-gray-500'}`}>
                        {isLightOn ? 'LIGHT ON' : 'COVER CAMERA'}
                    </div>

                    {/* Brightness indicator */}
                    <div className="w-48 h-3 bg-gray-800 rounded-full overflow-hidden mx-auto mb-4">
                        <div
                            className={`h-full transition-all duration-100 rounded-full ${isLightOn ? 'bg-amber-400' : 'bg-gray-600'
                                }`}
                            style={{ width: `${(1 - brightness) * 100}%` }}
                        />
                    </div>

                    <div className="text-sm text-gray-500">
                        {Math.round(brightness * 100)}% light detected
                    </div>

                    {error && (
                        <div className="mt-4 text-red-400 text-sm">⚠️ {error}</div>
                    )}
                </div>

                {/* Connection status */}
                <div className="absolute bottom-8 left-0 right-0 text-center">
                    <div className={`inline-block px-4 py-2 rounded-full text-xs ${isConnected
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-gray-800 text-gray-500'
                        }`}>
                        {isConnected ? '● Connected to desktop' : '○ Waiting for connection'}
                    </div>
                </div>
            </div>
        );
    }

    // --- CAMERA MODE ---
    if (modeParam === 'camera') {
        const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
        const [activeCamera, setActiveCamera] = useState<'user' | 'environment'>('environment');
        const [stream, setStream] = useState<MediaStream | null>(null);
        const [isStreaming, setIsStreaming] = useState(false);
        const [isAnalyzing, setIsAnalyzing] = useState(false);
        const [error, setError] = useState<string | null>(null);
        const [analysis, setAnalysis] = useState<{
            avgColor: { r: number; g: number; b: number };
            brightness: number;
            colorName: string;
        } | null>(null);

        const videoRef = useRef<HTMLVideoElement>(null);
        const canvasRef = useRef<HTMLCanvasElement>(null);
        const analysisRef = useRef<number>(0);

        // Discover cameras on mount
        useEffect(() => {
            const discoverCameras = async () => {
                try {
                    await navigator.mediaDevices.getUserMedia({ video: true });
                    const devices = await navigator.mediaDevices.enumerateDevices();
                    const videoDevices = devices.filter(d => d.kind === 'videoinput');
                    setCameras(videoDevices);

                    if (connRef.current?.open) {
                        connRef.current.send({
                            type: 'CAMERA_INFO',
                            payload: {
                                count: videoDevices.length,
                                cameras: videoDevices.map(d => ({ id: d.deviceId, label: d.label }))
                            }
                        });
                    }
                } catch (e: any) {
                    setError(e.message);
                }
            };
            discoverCameras();
        }, []);

        // Frame analysis loop
        useEffect(() => {
            if (!isAnalyzing || !videoRef.current || !canvasRef.current) return;

            const video = videoRef.current;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            let lastSendTime = 0;
            const SEND_INTERVAL = 100; // Send to desktop every 100ms

            const analyzeLoop = () => {
                if (!isAnalyzing) return;

                if (video.readyState >= video.HAVE_CURRENT_DATA) {
                    const width = video.videoWidth;
                    const height = video.videoHeight;

                    if (width > 0 && height > 0) {
                        // Scale down for performance
                        const scale = 0.2;
                        canvas.width = width * scale;
                        canvas.height = height * scale;
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        const data = imageData.data;

                        let totalR = 0, totalG = 0, totalB = 0, totalBrightness = 0;
                        const sampleStep = 4; // Sample every 4th pixel
                        let count = 0;

                        for (let i = 0; i < data.length; i += 4 * sampleStep) {
                            const r = data[i], g = data[i + 1], b = data[i + 2];
                            totalR += r; totalG += g; totalB += b;
                            totalBrightness += (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                            count++;
                        }

                        const avgR = Math.round(totalR / count);
                        const avgG = Math.round(totalG / count);
                        const avgB = Math.round(totalB / count);
                        const brightness = totalBrightness / count;

                        // Get color name
                        const rgbToHsl = (r: number, g: number, b: number) => {
                            r /= 255; g /= 255; b /= 255;
                            const max = Math.max(r, g, b), min = Math.min(r, g, b);
                            let h = 0, s = 0;
                            const l = (max + min) / 2;
                            if (max !== min) {
                                const d = max - min;
                                s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                                switch (max) {
                                    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                                    case g: h = ((b - r) / d + 2) / 6; break;
                                    case b: h = ((r - g) / d + 4) / 6; break;
                                }
                            }
                            return { h: h * 360, s: s * 100, l: l * 100 };
                        };

                        const { h, s, l } = rgbToHsl(avgR, avgG, avgB);
                        let colorName = 'Unknown';
                        if (l < 15) colorName = 'Black';
                        else if (l > 85 && s < 20) colorName = 'White';
                        else if (s < 15) colorName = 'Gray';
                        else if (h < 15 || h >= 345) colorName = 'Red';
                        else if (h < 45) colorName = 'Orange';
                        else if (h < 75) colorName = 'Yellow';
                        else if (h < 165) colorName = 'Green';
                        else if (h < 195) colorName = 'Cyan';
                        else if (h < 255) colorName = 'Blue';
                        else if (h < 285) colorName = 'Purple';
                        else if (h < 345) colorName = 'Pink';

                        setAnalysis({
                            avgColor: { r: avgR, g: avgG, b: avgB },
                            brightness,
                            colorName
                        });

                        // Throttle sending to desktop
                        const now = Date.now();
                        if (now - lastSendTime > SEND_INTERVAL && connRef.current?.open) {
                            connRef.current.send({
                                type: 'FRAME_ANALYSIS',
                                payload: {
                                    avgColor: { r: avgR, g: avgG, b: avgB },
                                    brightness,
                                    colorName,
                                    timestamp: now
                                }
                            });
                            lastSendTime = now;
                        }
                    }
                }

                analysisRef.current = requestAnimationFrame(analyzeLoop);
            };

            analyzeLoop();

            return () => {
                if (analysisRef.current) cancelAnimationFrame(analysisRef.current);
            };
        }, [isAnalyzing]);

        const startCamera = async (facing: 'user' | 'environment') => {
            try {
                if (stream) stream.getTracks().forEach(t => t.stop());

                const newStream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
                    audio: false
                });

                setStream(newStream);
                setActiveCamera(facing);
                setIsStreaming(true);

                if (videoRef.current) {
                    videoRef.current.srcObject = newStream;
                }

                if (connRef.current?.open) {
                    connRef.current.send({
                        type: 'CAMERA_STATUS',
                        payload: { streaming: true, facing }
                    });
                }
            } catch (e: any) {
                setError(e.message);
            }
        };

        const stopCamera = () => {
            if (stream) {
                stream.getTracks().forEach(t => t.stop());
                setStream(null);
            }
            setIsStreaming(false);
            setIsAnalyzing(false);
            if (analysisRef.current) cancelAnimationFrame(analysisRef.current);
            if (connRef.current?.open) {
                connRef.current.send({
                    type: 'CAMERA_STATUS',
                    payload: { streaming: false }
                });
            }
        };

        const toggleAnalysis = () => {
            setIsAnalyzing(!isAnalyzing);
        };

        const switchCamera = () => {
            const newFacing = activeCamera === 'user' ? 'environment' : 'user';
            startCamera(newFacing);
        };

        return (
            <div className="h-full w-full bg-black text-white font-mono flex flex-col">
                {/* Hidden canvas for frame analysis - off-screen, not display:none */}
                <canvas ref={canvasRef} style={{ position: 'absolute', left: '-9999px' }} />

                {/* Header */}
                <div className="p-4 flex justify-between items-center border-b border-white/10 bg-gray-900">
                    <h1 className="text-lg font-bold text-purple-400">📷 CAMERA LAB</h1>
                    <div className="flex items-center gap-2">
                        {isAnalyzing && <span className="text-xs text-green-400 animate-pulse">ANALYZING</span>}
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                    </div>
                </div>

                {/* Video Preview */}
                <div className="flex-1 relative bg-gray-800">
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                    />

                    {/* Analysis Overlay */}
                    {isAnalyzing && analysis && (
                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent">
                            {/* Color swatch and info */}
                            <div className="flex items-center gap-3 mb-3">
                                <div
                                    className="w-16 h-16 rounded-lg border-2 border-white/30 shadow-lg"
                                    style={{ backgroundColor: `rgb(${analysis.avgColor.r}, ${analysis.avgColor.g}, ${analysis.avgColor.b})` }}
                                />
                                <div>
                                    <div className="text-2xl font-bold">{analysis.colorName}</div>
                                    <div className="text-xs text-gray-400">
                                        RGB({analysis.avgColor.r}, {analysis.avgColor.g}, {analysis.avgColor.b})
                                    </div>
                                </div>
                            </div>

                            {/* Brightness bar */}
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-400">BRIGHTNESS</span>
                                    <span className="text-yellow-400">{Math.round(analysis.brightness * 100)}%</span>
                                </div>
                                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-gray-500 to-yellow-400 transition-all duration-100"
                                        style={{ width: `${analysis.brightness * 100}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {!isStreaming && (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                            <span className="text-4xl">📷</span>
                        </div>
                    )}
                    {isStreaming && !isAnalyzing && (
                        <div className="absolute top-2 left-2 px-2 py-1 bg-red-500 rounded text-xs animate-pulse">
                            ● LIVE
                        </div>
                    )}
                </div>

                {/* Controls */}
                <div className="p-4 bg-gray-900 space-y-3">
                    {/* Camera selection */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => startCamera('environment')}
                            className={`flex-1 py-2 rounded-lg font-bold text-sm transition-colors ${activeCamera === 'environment' && isStreaming
                                ? 'bg-purple-600'
                                : 'bg-gray-700 hover:bg-gray-600'
                                }`}
                        >
                            🔙 BACK
                        </button>
                        <button
                            onClick={() => startCamera('user')}
                            className={`flex-1 py-2 rounded-lg font-bold text-sm transition-colors ${activeCamera === 'user' && isStreaming
                                ? 'bg-purple-600'
                                : 'bg-gray-700 hover:bg-gray-600'
                                }`}
                        >
                            🤳 FRONT
                        </button>
                    </div>

                    {/* Main actions */}
                    <div className="flex gap-2">
                        <button
                            onClick={isStreaming ? stopCamera : () => startCamera(activeCamera)}
                            className={`flex-1 py-3 rounded-xl font-bold transition-colors ${isStreaming
                                ? 'bg-red-600 hover:bg-red-500'
                                : 'bg-green-600 hover:bg-green-500'
                                }`}
                        >
                            {isStreaming ? '⏹ STOP' : '▶ START'}
                        </button>
                        {isStreaming && (
                            <button
                                onClick={toggleAnalysis}
                                className={`flex-1 py-3 rounded-xl font-bold transition-colors ${isAnalyzing
                                    ? 'bg-yellow-500 text-black'
                                    : 'bg-cyan-600 hover:bg-cyan-500'
                                    }`}
                            >
                                {isAnalyzing ? '⏸ PAUSE' : '🔬 ANALYZE'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-2 bg-black/30 text-[10px] text-center text-purple-500/50 border-t border-white/5">
                    CAMERA LAB · {cameras.length} devices · {isAnalyzing ? 'ANALYZING' : isStreaming ? 'STREAMING' : 'IDLE'}
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
