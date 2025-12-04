"use client";
import "./global.css";
export { Metadata } from "next";
import { Inter } from "next/font/google";
import { AnimatePresence, motion } from "framer-motion";
import Navbar from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const Metadata = {
  title: "AI Media Analyzer",
  description: "Smooth, premium animated UI",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Navbar />
        <AnimatePresence mode="wait">
          <motion.div
            key={Math.random()}
            initial={{ opacity: 0, y: 0 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </body>
    </html>
  );
}
