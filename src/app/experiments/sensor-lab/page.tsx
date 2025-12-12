"use client";

import React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { QROverlay } from "@/components/QROverlay";

const SensorDashboard = dynamic(() => import("@/components/experiments/SensorDashboard"), { ssr: false });

export default function SensorLabPage() {
    return (
        <main className="h-full w-full relative bg-black">
            <ErrorBoundary>
                <SensorDashboard />
            </ErrorBoundary>

            <QROverlay mode="sensor" />

            <Link
                href="/"
                className="absolute top-4 right-4 z-50 text-xs text-gray-500 hover:text-white transition-colors"
            >
                [ EXIT TO LOBBY ]
            </Link>
        </main>
    );
}
