"use client";

import React, { useEffect } from "react";
import QRCode from "react-qr-code";
import { useConnectionStore } from "@/store/connectionStore";
import { motion, AnimatePresence } from "framer-motion";

export default function QROverlay({ mode = 'cube' }: { mode?: string }) {
    const { sessionId, generateSessionId, isConnected } = useConnectionStore();

    useEffect(() => {
        if (!sessionId) {
            generateSessionId();
        }
    }, [sessionId, generateSessionId]);

    // Smart URL generation for mobile connection
    // - Local dev (accessed via localhost): Use HTTPS on local IP for phone
    // - Local dev (accessed via local IP already): Use same HTTPS URL
    // - Production (Vercel etc): Use current hostname
    const getMobileUrl = () => {
        if (typeof window === 'undefined') return '';

        const { protocol, hostname, port } = window.location;
        const isLocalDev = hostname === 'localhost' || hostname === '127.0.0.1';
        const isLocalNetwork = hostname.startsWith('10.') || hostname.startsWith('192.168.') || hostname.startsWith('172.');

        // Local development: Always use HTTPS via NGINX on local IP
        if (isLocalDev || isLocalNetwork) {
            // Use your local network IP with HTTPS (via NGINX on port 443)
            const localIP = '10.0.0.147';
            return `https://${localIP}/mobile?session=${sessionId}&mode=${mode}`;
        }

        // Production: Use current protocol and hostname
        return `${protocol}//${hostname}/mobile?session=${sessionId}&mode=${mode}`;
    };

    const mobileUrl = getMobileUrl();

    return (
        <AnimatePresence>
            {!isConnected && sessionId && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="absolute bottom-8 right-8 p-4 bg-black/80 backdrop-blur-md border border-white/10 rounded-xl flex flex-col items-center gap-4 z-50 hover:bg-black/90 transition-colors"
                >
                    <div className="bg-white p-2 rounded-lg">
                        <QRCode value={mobileUrl} size={120} />
                    </div>
                    <div className="text-center">
                        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Scan to Connect</p>
                        <p className="text-xl font-mono font-bold text-white tracking-widest">{sessionId}</p>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
