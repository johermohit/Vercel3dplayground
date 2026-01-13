"use client";

import Link from "next/link";
import { motion } from "framer-motion";

interface BackToLobbyProps {
    className?: string;
    variant?: "minimal" | "pill" | "icon";
}

export default function BackToLobby({
    className = "",
    variant = "pill"
}: BackToLobbyProps) {
    if (variant === "icon") {
        return (
            <Link
                href="/"
                className={`fixed top-4 left-4 z-50 w-10 h-10 bg-black/50 backdrop-blur-sm border border-white/10 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-black/80 hover:border-white/30 transition-all ${className}`}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
            </Link>
        );
    }

    if (variant === "minimal") {
        return (
            <Link
                href="/"
                className={`fixed top-4 left-4 z-50 text-xs text-gray-500 hover:text-white transition-colors ${className}`}
            >
                ← LOBBY
            </Link>
        );
    }

    // Default: pill style
    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`fixed top-4 left-4 z-50 ${className}`}
        >
            <Link
                href="/"
                className="flex items-center gap-2 px-3 py-1.5 bg-black/50 backdrop-blur-sm border border-white/10 rounded-full text-xs text-gray-400 hover:text-white hover:bg-black/80 hover:border-white/30 transition-all"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                <span>LOBBY</span>
            </Link>
        </motion.div>
    );
}
