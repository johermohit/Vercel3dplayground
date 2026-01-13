"use client";

import React from "react";
import dynamic from "next/dynamic";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import QROverlay from "@/components/QROverlay";
import BackToLobby from "@/components/BackToLobby";

const GravityScene = dynamic(() => import("@/components/experiments/GravityScene"), { ssr: false });

export default function GravityFieldPage() {
    return (
        <main className="h-full w-full relative">
            <BackToLobby />

            <ErrorBoundary>
                <React.Suspense fallback={<div className="text-white p-4">Initializing Gravity Well...</div>}>
                    <GravityScene />
                </React.Suspense>
            </ErrorBoundary>

            <QROverlay mode="gravity" />

            <div className="absolute top-12 left-4 pointer-events-none select-none">
                <h1 className="text-xl font-bold tracking-tighter">EXP-02 // GRAVITY FIELD</h1>
                <p className="text-xs text-gray-400">Touch screen to distort field.</p>
            </div>
        </main>
    );
}
