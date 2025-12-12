"use client";

import React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import QROverlay from "@/components/QROverlay";

const HyperScene = dynamic(() => import("@/components/experiments/HyperScene"), { ssr: false });

export default function HyperVisualsPage() {
    return (
        <main className="h-full w-full relative">
            <ErrorBoundary>
                <React.Suspense fallback={<div className="text-white p-4">Initializing Neural Link...</div>}>
                    <HyperScene />
                </React.Suspense>
            </ErrorBoundary>

            <QROverlay mode="hyper" />

            <div className="absolute top-0 left-0 p-4 pointer-events-none select-none z-10">
                <h1 className="text-xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-500">
                    EXP-03 // HYPER VISUALS
                </h1>
                <p className="text-xs text-gray-400">Post-Processing Stress Test.</p>
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
