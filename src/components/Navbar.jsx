"use client";
import Link from "next/link";
import { motion } from "framer-motion";

export default function Navbar() {
  return (
    <motion.nav
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className="fixed top-0 left-0 w-full z-50 backdrop-blur-xl bg-black/30 border-b border-white/10"
    >
      <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
        <Link href="/" className="text-xl font-bold">
          AI Analyzer
        </Link>
        <div className="flex gap-6">
          <Link href="/" className="hover:text-gray-300 transition">
            Home
          </Link>
          <Link href="/login" className="hover:text-gray-300 transition">
            Login
          </Link>
        </div>
      </div>
    </motion.nav>
  );
}
