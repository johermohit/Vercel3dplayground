"use client";

import React from "react";
import { useConnectionStore } from "@/store/connectionStore";
import { usePeerHost } from "@/hooks/usePeerHost";
import QROverlay from "@/components/QROverlay";
import BackToLobby from "@/components/BackToLobby";
import { motion, AnimatePresence } from "framer-motion";

export default function CameraLabPage() {
    usePeerHost();
    const { sensorData, isConnected } = useConnectionStore();
    const frameAnalysis = sensorData.frameAnalysis;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-purple-950/20 to-gray-950 text-white font-mono">
            <BackToLobby />

            {/* Header */}
            <header className="p-6 border-b border-purple-500/20">
                <div className="max-w-4xl mx-auto flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                            CAMERA LAB
                        </h1>
                        <p className="text-xs text-gray-500 mt-1">FRAME ANALYSIS · EXPERIMENT 10</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className={`px-3 py-1 rounded-full text-xs font-bold ${isConnected
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}>
                            {isConnected ? '● CONNECTED' : '○ WAITING'}
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="p-6">
                <div className="max-w-4xl mx-auto">
                    {!isConnected ? (
                        // Connection prompt
                        <div className="text-center py-20">
                            <div className="text-6xl mb-6">📷</div>
                            <h2 className="text-2xl font-bold mb-4">Connect Your Phone</h2>
                            <p className="text-gray-400 mb-8 max-w-md mx-auto">
                                Scan the QR code with your phone to start camera analysis.
                                Your phone captures frames and sends analysis data here.
                            </p>
                            <div className="inline-block">
                                <div className="bg-gray-900/50 border border-purple-500/30 rounded-xl p-6 backdrop-blur-sm">
                                    <p className="text-xs text-gray-500 mb-2">Open camera mode on phone:</p>
                                    <code className="text-purple-400 text-sm">/mobile?mode=camera</code>
                                </div>
                            </div>
                        </div>
                    ) : !frameAnalysis ? (
                        // Connected but no analysis yet
                        <div className="text-center py-20">
                            <div className="text-6xl mb-6 animate-pulse">🔬</div>
                            <h2 className="text-2xl font-bold mb-4">Phone Connected!</h2>
                            <p className="text-gray-400">
                                Tap <span className="text-cyan-400 font-bold">ANALYZE</span> on your phone to start frame analysis.
                            </p>
                        </div>
                    ) : (
                        // Live analysis display
                        <div className="space-y-8">
                            {/* Color Display */}
                            <motion.div
                                className="bg-gray-900/50 border border-purple-500/20 rounded-2xl p-8 backdrop-blur-sm"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                            >
                                <h3 className="text-xs text-gray-500 mb-6 tracking-widest">DOMINANT COLOR</h3>

                                <div className="flex items-center gap-8">
                                    {/* Large color swatch */}
                                    <motion.div
                                        className="w-40 h-40 rounded-2xl border-4 border-white/10 shadow-2xl"
                                        style={{
                                            backgroundColor: `rgb(${frameAnalysis.avgColor.r}, ${frameAnalysis.avgColor.g}, ${frameAnalysis.avgColor.b})`,
                                            boxShadow: `0 0 60px rgba(${frameAnalysis.avgColor.r}, ${frameAnalysis.avgColor.g}, ${frameAnalysis.avgColor.b}, 0.4)`
                                        }}
                                        animate={{
                                            backgroundColor: `rgb(${frameAnalysis.avgColor.r}, ${frameAnalysis.avgColor.g}, ${frameAnalysis.avgColor.b})`
                                        }}
                                        transition={{ duration: 0.1 }}
                                    />

                                    {/* Color info */}
                                    <div className="flex-1">
                                        <div className="text-5xl font-bold mb-4">{frameAnalysis.colorName}</div>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="bg-red-500/20 p-3 rounded-lg text-center">
                                                <div className="text-2xl font-bold text-red-400">{frameAnalysis.avgColor.r}</div>
                                                <div className="text-xs text-gray-500">RED</div>
                                            </div>
                                            <div className="bg-green-500/20 p-3 rounded-lg text-center">
                                                <div className="text-2xl font-bold text-green-400">{frameAnalysis.avgColor.g}</div>
                                                <div className="text-xs text-gray-500">GREEN</div>
                                            </div>
                                            <div className="bg-blue-500/20 p-3 rounded-lg text-center">
                                                <div className="text-2xl font-bold text-blue-400">{frameAnalysis.avgColor.b}</div>
                                                <div className="text-xs text-gray-500">BLUE</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>

                            {/* Brightness Display */}
                            <motion.div
                                className="bg-gray-900/50 border border-purple-500/20 rounded-2xl p-8 backdrop-blur-sm"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                            >
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-xs text-gray-500 tracking-widest">BRIGHTNESS LEVEL</h3>
                                    <span className="text-4xl font-bold text-yellow-400">
                                        {Math.round(frameAnalysis.brightness * 100)}%
                                    </span>
                                </div>

                                <div className="h-8 bg-gray-800 rounded-full overflow-hidden">
                                    <motion.div
                                        className="h-full rounded-full"
                                        style={{
                                            background: `linear-gradient(to right, #374151, #fbbf24, #fef3c7)`,
                                            width: `${frameAnalysis.brightness * 100}%`
                                        }}
                                        animate={{ width: `${frameAnalysis.brightness * 100}%` }}
                                        transition={{ duration: 0.1 }}
                                    />
                                </div>

                                <div className="flex justify-between text-xs text-gray-600 mt-2">
                                    <span>🌙 DARK</span>
                                    <span>☀️ BRIGHT</span>
                                </div>
                            </motion.div>

                            {/* Stats */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 text-center">
                                    <div className="text-xs text-gray-500 mb-1">HEX CODE</div>
                                    <div className="text-lg font-mono text-purple-400">
                                        #{frameAnalysis.avgColor.r.toString(16).padStart(2, '0')}
                                        {frameAnalysis.avgColor.g.toString(16).padStart(2, '0')}
                                        {frameAnalysis.avgColor.b.toString(16).padStart(2, '0')}
                                    </div>
                                </div>
                                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 text-center">
                                    <div className="text-xs text-gray-500 mb-1">LUMINANCE</div>
                                    <div className="text-lg text-yellow-400">
                                        {frameAnalysis.brightness < 0.3 ? 'Low' : frameAnalysis.brightness < 0.7 ? 'Medium' : 'High'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* QR Overlay */}
            <QROverlay mode="camera" />
        </div>
    );
}
