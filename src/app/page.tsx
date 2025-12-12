"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const experiments = [
  {
    id: "01",
    name: "Telekinetic Cube",
    href: "/experiments/telekinetic-cube",
    desc: "Peer-to-Peer gyroscope control via WebRTC",
    color: "white",
    tag: "LIVE",
    tagColor: "bg-green-500 text-black",
  },
  {
    id: "02",
    name: "Gravity Field",
    href: "/experiments/gravity-field",
    desc: "Particle swarm with gravitational repulsion",
    color: "white",
    tag: "LIVE",
    tagColor: "bg-green-500 text-black",
  },
  {
    id: "03",
    name: "Hyper Visuals",
    href: "/experiments/hyper-visuals",
    desc: "Cinematic post-processing showcase",
    color: "teal",
    tag: "BETA",
    tagColor: "bg-teal-500 text-black",
  },
  {
    id: "04",
    name: "Sensor Lab",
    href: "/experiments/sensor-lab",
    desc: "Raw device sensor data visualization",
    color: "gray",
    tag: "TOOL",
    tagColor: "bg-gray-400 text-black",
  },
  {
    id: "05",
    name: "Digital Clay",
    href: "/experiments/digital-clay",
    desc: "High-fidelity 3D sculpting with phone pressure",
    color: "orange",
    tag: "WIP",
    tagColor: "bg-orange-500 text-black",
  },
  {
    id: "06",
    name: "Aura Field",
    href: "/experiments/aura-field",
    desc: "Shader-driven plasma controlled by sensors",
    color: "purple",
    tag: "NEW",
    tagColor: "bg-purple-500 text-white",
  },
  {
    id: "07",
    name: "Touch the Clouds",
    href: "/experiments/touch-clouds",
    desc: "Spatial wand to part volumetric clouds",
    color: "blue",
    tag: "NEW",
    tagColor: "bg-blue-500 text-white",
  },
  {
    id: "08",
    name: "Blow Detection",
    href: "/experiments/blow-test",
    desc: "Microphone-based breath detection",
    color: "cyan",
    tag: "TEST",
    tagColor: "bg-yellow-500 text-black",
  },
];

const colorMap: Record<string, { border: string; bg: string; hover: string; text: string; desc: string }> = {
  white: { border: "border-white/20", bg: "bg-white/5", hover: "hover:bg-white/15", text: "text-white", desc: "text-gray-400" },
  teal: { border: "border-teal-500/30", bg: "bg-teal-900/20", hover: "hover:bg-teal-800/40", text: "text-teal-300", desc: "text-teal-400/70" },
  gray: { border: "border-gray-700", bg: "bg-gray-900/50", hover: "hover:bg-gray-800/80", text: "text-gray-300", desc: "text-gray-500" },
  orange: { border: "border-orange-500/30", bg: "bg-orange-900/20", hover: "hover:bg-orange-800/40", text: "text-orange-300", desc: "text-orange-400/70" },
  purple: { border: "border-purple-500/30", bg: "bg-purple-900/20", hover: "hover:bg-purple-800/40", text: "text-purple-300", desc: "text-purple-400/70" },
  blue: { border: "border-blue-500/30", bg: "bg-blue-900/20", hover: "hover:bg-blue-800/40", text: "text-blue-300", desc: "text-blue-400/70" },
  cyan: { border: "border-cyan-500/30", bg: "bg-cyan-900/20", hover: "hover:bg-cyan-800/40", text: "text-cyan-300", desc: "text-cyan-400/70" },
};

export default function Lobby() {
  return (
    <main className="min-h-screen w-full bg-black text-white relative overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-teal-500/5 rounded-full blur-[150px]" />
      </div>

      {/* Grid overlay */}
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }}
      />

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-16">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-16"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-[10px] uppercase tracking-[0.3em] text-gray-500">Interactive Playground</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-white via-gray-300 to-gray-500 bg-clip-text text-transparent">
              makewithmohit
            </span>
          </h1>

          <p className="text-gray-500 mt-4 text-sm max-w-md">
            A collection of experimental phone-to-desktop interactions.
            <span className="text-gray-600"> Scan QR codes. Use your phone as a controller.</span>
          </p>
        </motion.header>

        {/* Gallery Grid */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-2 mb-6">
            <div className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent" />
            <span className="text-[10px] uppercase tracking-widest text-gray-600">Experiments</span>
            <div className="h-px flex-1 bg-gradient-to-l from-white/20 to-transparent" />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {experiments.map((exp, i) => {
              const colors = colorMap[exp.color];
              return (
                <Link key={exp.id} href={exp.href}>
                  <motion.article
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * i }}
                    whileHover={{ scale: 1.02, y: -2 }}
                    className={`group relative ${colors.border} border ${colors.bg} ${colors.hover} p-5 rounded-2xl cursor-pointer transition-all duration-300 backdrop-blur-sm`}
                  >
                    {/* Number badge */}
                    <div className="absolute -top-2 -left-2 w-8 h-8 bg-black border border-white/10 rounded-lg flex items-center justify-center">
                      <span className="text-[10px] font-bold text-gray-400">{exp.id}</span>
                    </div>

                    {/* Tag */}
                    <div className="absolute top-3 right-3">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${exp.tagColor}`}>
                        {exp.tag}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="pt-2">
                      <h2 className={`text-lg font-semibold ${colors.text} mb-1 group-hover:translate-x-1 transition-transform`}>
                        {exp.name}
                      </h2>
                      <p className={`text-xs ${colors.desc} leading-relaxed`}>
                        {exp.desc}
                      </p>
                    </div>

                    {/* Hover arrow */}
                    <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-gray-500 text-sm">→</span>
                    </div>
                  </motion.article>
                </Link>
              );
            })}
          </div>
        </motion.section>

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-16 pt-8 border-t border-white/5"
        >
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-600">
            <div className="flex items-center gap-4">
              <span>Built with Next.js + Three.js + PeerJS</span>
              <span className="hidden md:inline">•</span>
              <span className="hidden md:inline">Deployed on Vercel</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              <span>System Online</span>
            </div>
          </div>
        </motion.footer>
      </div>
    </main>
  );
}
