"use client";

import { useEffect, useState, useCallback } from "react";

interface OrientationData {
    alpha: number;
    beta: number;
    gamma: number;
}

interface UseOrientationSensorReturn {
    orientation: OrientationData;
    isSupported: boolean;
    requestPermission: () => Promise<boolean>;
}

/**
 * Shared hook for device orientation sensor
 * Handles orientation events and iOS permission requests
 */
export function useOrientationSensor(
    onOrientationChange?: (data: OrientationData) => void
): UseOrientationSensorReturn {
    const [orientation, setOrientation] = useState<OrientationData>({
        alpha: 0,
        beta: 0,
        gamma: 0,
    });
    const [isSupported, setIsSupported] = useState(false);

    // Check support
    useEffect(() => {
        setIsSupported("DeviceOrientationEvent" in window);
    }, []);

    // Handle orientation events
    useEffect(() => {
        const handleOrientation = (e: DeviceOrientationEvent) => {
            const data = {
                alpha: e.alpha || 0,
                beta: e.beta || 0,
                gamma: e.gamma || 0,
            };
            setOrientation(data);
            onOrientationChange?.(data);
        };

        window.addEventListener("deviceorientation", handleOrientation);
        return () => window.removeEventListener("deviceorientation", handleOrientation);
    }, [onOrientationChange]);

    // iOS permission request
    const requestPermission = useCallback(async (): Promise<boolean> => {
        // @ts-ignore - DeviceOrientationEvent.requestPermission is iOS-specific
        if (typeof DeviceOrientationEvent.requestPermission === "function") {
            try {
                // @ts-ignore
                const permission = await DeviceOrientationEvent.requestPermission();
                return permission === "granted";
            } catch {
                return false;
            }
        }
        // Non-iOS devices don't need permission
        return true;
    }, []);

    return {
        orientation,
        isSupported,
        requestPermission,
    };
}
