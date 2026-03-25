"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useConnectionStore } from "@/store/connectionStore";
import type { DataConnection } from "peerjs";

interface UseMobileConnectionReturn {
    isConnected: boolean;
    status: string;
    sessionId: string | null;
    mode: string;
    send: (data: any) => void;
    connRef: React.RefObject<DataConnection | null>;
}

/**
 * Shared hook for mobile connection to desktop via PeerJS
 * Handles session initialization, connection state, and data sending
 */
export function useMobileConnection(): UseMobileConnectionReturn {
    const searchParams = useSearchParams();
    const sessionParam = searchParams.get("session");
    const modeParam = searchParams.get("mode") || "default";

    const { setSessionId, setConnected, isConnected } = useConnectionStore();
    const [status, setStatus] = useState("Idle");
    const connRef = useRef<DataConnection | null>(null);

    // Initialize PeerJS connection
    useEffect(() => {
        if (!sessionParam) return;

        setSessionId(sessionParam);
        let peer: any = null;

        const initClient = async () => {
            const { Peer } = await import("peerjs");
            peer = new Peer();

            peer.on("open", () => {
                setStatus("Connecting...");
                const conn = peer.connect(sessionParam);

                conn.on("open", () => {
                    setStatus("Connected");
                    setConnected(true);
                    connRef.current = conn;
                });

                conn.on("close", () => {
                    setStatus("Disconnected");
                    setConnected(false);
                    connRef.current = null;
                });

                conn.on("error", (err: Error) => {
                    console.error("Connection error:", err);
                    setStatus("Error");
                    setConnected(false);
                });
            });

            peer.on("error", (err: Error) => {
                console.error("Peer error:", err);
                setStatus("Error");
            });
        };

        initClient();

        return () => {
            if (peer) {
                peer.destroy();
            }
        };
    }, [sessionParam, setSessionId, setConnected]);

    // Send data helper
    const send = useCallback((data: any) => {
        if (connRef.current?.open) {
            connRef.current.send(data);
        }
    }, []);

    return {
        isConnected,
        status,
        sessionId: sessionParam,
        mode: modeParam,
        send,
        connRef,
    };
}
