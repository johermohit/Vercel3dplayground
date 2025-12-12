import React from 'react';
import { useConnectionStore } from '@/store/connectionStore';
import { usePeerHost } from '@/hooks/usePeerHost';
import { motion } from 'framer-motion';

function SensorCard({ title, data, icon }: { title: string, data: any, icon: string }) {
    if (!data) return (
        <div className="bg-gray-900/50 border border-gray-800 p-4 rounded-xl opacity-50">
            <h3 className="text-gray-500 font-mono text-xs mb-2 flex items-center gap-2">
                <span>{icon}</span> {title}
            </h3>
            <p className="text-gray-600 italic text-sm">Waiting for data...</p>
        </div>
    );

    return (
        <div className="bg-gray-900 border border-teal-500/30 p-4 rounded-xl shadow-[0_0_15px_-5px_var(--tw-shadow-color)] shadow-teal-500/10">
            <h3 className="text-teal-400 font-mono text-xs mb-4 flex items-center gap-2 border-b border-gray-800 pb-2">
                <span>{icon}</span> {title}
            </h3>
            <div className="space-y-2">
                {Object.entries(data).map(([key, value]) => (
                    <div key={key} className="flex justify-between items-center text-sm">
                        <span className="text-gray-400 capitalize">{key}:</span>
                        <span className="font-mono text-white">
                            {typeof value === 'number' ? value.toFixed(2) : String(value)}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function SensorDashboard() {
    usePeerHost();
    const { sensorData, isConnected } = useConnectionStore();

    return (
        <div className="w-full h-full bg-black p-8 overflow-auto">
            <div className="max-w-4xl mx-auto">
                <header className="mb-12 flex items-center justify-between border-b border-gray-800 pb-8">
                    <div>
                        <h1 className="text-4xl font-bold tracking-tighter text-white mb-2">SENSOR LAB</h1>
                        <p className="text-gray-500 font-mono text-xs">DIAGNOSTIC//BRIDGE//V4</p>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-xs">
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className={isConnected ? "text-green-500" : "text-red-500"}>
                            {isConnected ? "DEVICE CONNECTED" : "NO SIGNAL"}
                        </span>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <SensorCard
                        title="POWER CELL"
                        icon="🔋"
                        data={sensorData.battery}
                    />
                    <SensorCard
                        title="ORIENTATION"
                        icon="🧭"
                        data={sensorData.orientation}
                    />
                    <SensorCard
                        title="ACCELEROMETER"
                        icon="🚀"
                        data={sensorData.acceleration}
                    />
                    <SensorCard
                        title="DISPLAY MATRIX"
                        icon="📱"
                        data={sensorData.screen}
                    />
                    <SensorCard
                        title="TOUCH ANALYSIS"
                        icon="👆"
                        data={sensorData.touch}
                    />
                    <div className="bg-gray-900/30 border border-gray-800 p-4 rounded-xl flex flex-col justify-center items-center text-center">
                        <span className="text-4xl mb-4">🔮</span>
                        <h3 className="text-teal-400 font-bold mb-2">Capabilities</h3>
                        <p className="text-gray-500 text-xs">
                            Use this data to determine what experiments your device supports.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
