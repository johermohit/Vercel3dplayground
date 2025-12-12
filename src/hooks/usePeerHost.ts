import { useEffect } from 'react';
import { useConnectionStore } from '@/store/connectionStore';
import type { Peer } from 'peerjs';

export function usePeerHost() {
    const { sessionId, setConnected, setRotation, setColor, rotation } = useConnectionStore();

    useEffect(() => {
        if (!sessionId) return;

        let peer: Peer;
        let cancelled = false;

        const initPeer = async () => {
            try {
                const { Peer } = await import('peerjs');
                if (cancelled) return; // Prevent creation if unmounted

                console.log("Initializing Peer with ID:", sessionId);
                peer = new Peer(sessionId);

                peer.on('open', (id) => {
                    console.log('Host Peer ID:', id);
                    if (cancelled) peer.destroy();
                });

                peer.on('connection', (conn) => {
                    console.log('Mobile connected!');
                    setConnected(true);

                    conn.on('data', (data: any) => {
                        // Heartbeat/Logic
                        if (data.type === 'ROTATE') {
                            const current = useConnectionStore.getState().rotation;
                            useConnectionStore.getState().setRotation({
                                x: current.x + data.y * 0.5,
                                y: current.y + data.x * 0.5
                            });
                        }
                        if (data.type === 'COLOR') {
                            useConnectionStore.getState().setColor(data.color);
                        }
                        if (data.type === 'INTENSITY') {
                            useConnectionStore.getState().setIntensity(data.value);
                        }
                        if (data.type === 'GLITCH') {
                            useConnectionStore.getState().setGlitch(data.active);
                        }
                        if (data.type === 'SENSOR_DATA') {
                            useConnectionStore.getState().setSensorData(data.payload);
                        }
                        if (data.type === 'CLAY_INPUT') {
                            // FAST PATH: Write purely to memory buffer
                            // Do NOT trigger React State updates
                            import('@/utils/clayMemory').then(({ setClayFrame }) => {
                                setClayFrame(data.payload);
                            });
                        }
                        if (data.type === 'WAND_POSITION') {
                            // Store wand position for cloud experiment
                            useConnectionStore.getState().setSensorData({ wand: data.payload });
                        }
                        if (data.type === 'BLOW_DATA') {
                            // Store blow intensity for blow experiments
                            useConnectionStore.getState().setSensorData({ blow: data.payload });
                        }
                    });

                    conn.on('close', () => {
                        console.log("Mobile Disconnected");
                        setConnected(false);
                    });
                    conn.on('error', (err) => {
                        console.error("Connection Error:", err);
                        setConnected(false);
                    });
                });

                peer.on('error', (err) => {
                    console.error("Peer Error:", err);
                });

            } catch (e) {
                console.error("Failed to load PeerJS", e);
            }
        };

        const cleanup = () => {
            cancelled = true;
            console.log("Cleaning up PeerHost...");
            if (peer) {
                peer.destroy();
            }
        };

        initPeer();

        return cleanup;
    }, [sessionId, setConnected]);
}
