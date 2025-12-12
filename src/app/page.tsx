"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function Lobby() {
  return (
    <main className="h-full w-full bg-black text-white flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-900 via-black to-black opacity-50" />

      <div className="z-10 text-center max-w-2xl px-6">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-6xl md:text-8xl font-bold tracking-tighter mb-4"
        >
          ANTIGRAVITY
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-gray-500 mb-12 uppercase tracking-widest text-sm"
        >
          V2 // Experimental Archives
        </motion.p>

        <div className="grid gap-4 w-full">
          {/* Experiment 01 */}
          <Link href="/experiments/telekinetic-cube">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              whileHover={{ scale: 1.02 }}
              className="group border border-white/10 bg-white/5 hover:bg-white/10 p-6 rounded-xl text-left transition-all cursor-pointer relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-xs bg-white text-black px-2 py-1 rounded-full font-bold">OPEN</span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">01. Telekinetic Cube</h2>
              <p className="text-gray-400 text-sm">
                Peer-to-Peer gyroscope & touch interaction demo.
                Using WebRTC for zero-latency control.
              </p>
            </motion.div>
          </Link>

          {/* Experiment 02 */}
          <Link href="/experiments/gravity-field">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              whileHover={{ scale: 1.02 }}
              className="group border border-white/10 bg-white/5 hover:bg-white/10 p-6 rounded-xl text-left transition-all cursor-pointer relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-xs bg-white text-black px-2 py-1 rounded-full font-bold">NEW</span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">02. Gravity Field</h2>
              <p className="text-gray-400 text-sm">
                Massive particle swarm simulation.
                Phone acts as a gravitational repulsor.
              </p>
            </motion.div>
          </Link>

          {/* Experiment 03 */}
          <Link href="/experiments/hyper-visuals">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
              whileHover={{ scale: 1.02 }}
              className="group border border-teal-500/30 bg-teal-900/10 hover:bg-teal-900/20 p-6 rounded-xl text-left transition-all cursor-pointer relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-xs bg-teal-500 text-black px-2 py-1 rounded-full font-bold">BETA</span>
              </div>
              <h2 className="text-2xl font-bold text-teal-400 mb-2">03. Hyper Visuals</h2>
              <p className="text-teal-200/50 text-sm">
                Cinematic Post-Processing Showcase.
                Bloom, Glitch, and Chromatic Aberration.
              </p>
            </motion.div>
          </Link>
          {/* Experiment 04 */}
          <Link href="/experiments/sensor-lab">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 }}
              whileHover={{ scale: 1.02 }}
              className="group border border-gray-800 bg-gray-900/50 hover:bg-gray-800 p-6 rounded-xl text-left transition-all cursor-pointer relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-xs bg-gray-200 text-black px-2 py-1 rounded-full font-bold">TOOL</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-200 mb-2">04. Sensor Lab</h2>
              <p className="text-gray-500 text-sm">
                Diagnostic Tool.
                Visualize your device's raw sensor data output.
              </p>
            </motion.div>
          </Link>


          {/* Experiment 05 */}
          <Link href="/experiments/digital-clay">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 }}
              whileHover={{ scale: 1.02 }}
              className="group border border-white/20 bg-white/10 hover:bg-white/20 p-6 rounded-xl text-left transition-all cursor-pointer relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-xs bg-purple-500 text-white px-2 py-1 rounded-full font-bold">WIP</span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">05. Digital Clay</h2>
              <p className="text-gray-400 text-sm">
                High-Fidelity Sculpting.
                Use your phone pressure to deform 3D geometry.
              </p>
            </motion.div>
          </Link>

          {/* Experiment 06 */}
          <Link href="/experiments/aura-field">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.9 }}
              whileHover={{ scale: 1.02 }}
              className="group border border-purple-500/30 bg-purple-900/20 hover:bg-purple-800/30 p-6 rounded-xl text-left transition-all cursor-pointer relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-xs bg-purple-500 text-white px-2 py-1 rounded-full font-bold">NEW</span>
              </div>
              <h2 className="text-2xl font-bold text-purple-200 mb-2">06. Aura Field</h2>
              <p className="text-purple-300/70 text-sm">
                Shader-Driven Energy.
                Control an ethereal plasma field with your phone's sensors.
              </p>
            </motion.div>
          </Link>

          {/* Experiment 07 */}
          <Link href="/experiments/touch-clouds">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.0 }}
              whileHover={{ scale: 1.02 }}
              className="group border border-blue-500/30 bg-blue-900/20 hover:bg-blue-800/30 p-6 rounded-xl text-left transition-all cursor-pointer relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded-full font-bold">NEW</span>
              </div>
              <h2 className="text-2xl font-bold text-blue-200 mb-2">07. Touch the Clouds</h2>
              <p className="text-blue-300/70 text-sm">
                Spatial Interaction.
                Part volumetric clouds with your phone as a magic wand.
              </p>
            </motion.div>
          </Link>
        </div>
      </div>

      <div className="absolute bottom-8 text-xs text-gray-600">
        System Status: Online // Vercel Edge
      </div>
    </main >
  );
}
