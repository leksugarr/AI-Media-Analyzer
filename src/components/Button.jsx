"use client";
import { motion } from "framer-motion";

export default function Button({ children, ...props }) {
  return (
    <motion.button
      className="btn-primary"
      whileHover={{
        scale: 1.05,
        boxShadow: "0px 0px 20px rgba(0,120,255,0.6)",
      }}
      whileTap={{ scale: 0.95 }}
      transition={{ duration: 0.15 }}
      {...props} // forward all props, including onClick
    >
      {children}
    </motion.button>
  );
}
