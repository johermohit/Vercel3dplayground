"use client";

import React from "react";
import dynamic from "next/dynamic";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import QROverlay from "@/components/QROverlay";
import BackToLobby from "@/components/BackToLobby";

const Scene = dynamic(() => import("@/components/Scene"), { ssr: false });

export default function TelekineticCubePage() {
    return (
        <main className="h-full w-full relative">
            <BackToLobby />

            <ErrorBoundary>
                <React.Suspense fallback={<div className="text-white p-4">Loading 3D Engine...</div>}>
                    <Scene />
                </React.Suspense>
            </ErrorBoundary>

            <QROverlay mode="cube" />

            <div className="absolute top-12 left-4 pointer-events-none select-none">
                <h1 className="text-xl font-bold tracking-tighter">EXP-01 // TELEKINETIC CUBE</h1>
                <p className="text-xs text-gray-400">Status: Active</p>
            </div>
        </main>
    );
}
