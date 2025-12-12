"use client";

import React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { QROverlay } from "@/components/QROverlay";

const Scene = dynamic(() => import("@/components/Scene"), { ssr: false });

export default function TelekineticCubePage() {
    return (
        <main className="h-full w-full relative">
            <ErrorBoundary>
                <React.Suspense fallback={<div className="text-white p-4">Loading 3D Engine...</div>}>
                    <Scene />
                </React.Suspense>
            </ErrorBoundary>

            {/* Pass mode='cube' to QR Overlay */}
            <QROverlay mode="cube" />

            <div className="absolute top-0 left-0 p-4 pointer-events-none select-none">
                <h1 className="text-xl font-bold tracking-tighter">EXP-01 // TELEKINETIC CUBE</h1>
                <p className="text-xs text-gray-400">Status: Active</p>
            </div>

            <Link
                href="/"
                className="absolute top-4 right-4 z-50 text-xs text-gray-500 hover:text-white transition-colors"
            >
                [ EXIT TO LOBBY ]
            </Link>
        </main>
    );
}
