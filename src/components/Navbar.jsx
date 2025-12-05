"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Top Navbar */}
      <motion.nav
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="fixed top-0 left-0 w-full z-50 backdrop-blur-xl bg-black/30 border-b border-white/10"
      >
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          {/* Logo */}
          <Link
            href="/"
            className="text-xl font-semibold bg-gradient-to-r 
            from-blue-400 to-blue-200 bg-clip-text text-transparent hover:text-white"
          >
            AI Analyzer
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/" className="hover:text-blue-400">
              Home
            </Link>
            <Link href="/login" className="hover:text-blue-400">
              Login
            </Link>
          </div>

          {/* Hamburger Button */}
          <motion.button
            className="md:hidden p-2 rounded-lg bg-neutral-800/50 backdrop-blur-lg"
            onClick={() => setOpen(!open)}
            whileTap={{ scale: 0.9 }}
          >
            <div className="space-y-1.5">
              <span
                className={`block h-0.5 w-6 bg-white transition-all ${
                  open ? "rotate-45 translate-y-2" : ""
                }`}
              ></span>
              <span
                className={`block h-0.5 w-6 bg-white transition-all ${
                  open ? "opacity-0" : ""
                }`}
              ></span>
              <span
                className={`block h-0.5 w-6 bg-white transition-all ${
                  open ? "-rotate-45 -translate-y-2" : ""
                }`}
              ></span>
            </div>
          </motion.button>
        </div>
      </motion.nav>

      {/* Mobile Menu Drawer */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            transition={{ duration: 0.25 }}
            className="fixed top-16 right-0 w-[75%] h-screen 
                       bg-neutral-900/60 backdrop-blur-2xl 
                       border-l border-white/10 p-6 flex flex-col 
                       gap-6 z-40"
          >
            <Link
              href="/"
              className="text-lg hover:text-blue-400"
              onClick={() => setOpen(false)}
            >
              Home
            </Link>
            <Link
              href="/login"
              className="text-lg hover:text-blue-400"
              onClick={() => setOpen(false)}
            >
              Login
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
