"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTranslations, useLocale } from "next-intl";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("nav");
  const locale = useLocale();

  const handleLogout = () => {
    logout();
    router.push(`/${locale}/login`);
    setOpen(false);
  };

  const toggleLocale = () => {
    const nextLocale = locale === "en" ? "zh" : "en";
    // Replace current locale prefix with new one
    const newPath = pathname.replace(`/${locale}`, `/${nextLocale}`);
    router.push(newPath);
  };

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
            className="text-xl font-semibold bg-gradient-to-r from-blue-400 to-blue-200 bg-clip-text text-transparent hover:text-white"
          >
            AI Media Analyzer
          </Link>

          {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-8">
              <Link href={`/${locale}`} className="hover:text-blue-400">
                Home
              </Link>
              <Link href={`/${locale}/dashboard`} className="hover:text-blue-400">
                {t("dashboard")}
              </Link>
              <Link href={`/${locale}/about`} className="hover:text-blue-400">
                {t("about")}
              </Link>
              {user ? (
                <>
                  <span className="text-xs text-gray-400">{user.email}</span>
                  <button
                    onClick={handleLogout}
                    className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-red-500/20 hover:text-red-400 text-sm transition"
                  >
                    {t("logout")}
                  </button>
                </>
              ) : (
                <Link href={`/${locale}/login`} className="hover:text-blue-400">
                  {t("login")}
                </Link>
              )}
              {/* Language switcher */}
              <button
                onClick={toggleLocale}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm transition font-medium"
              >
                {locale === "en" ? "中文" : "EN"}
              </button>
            </div>
          {/* Hamburger Button */}
          <motion.button
            className="md:hidden p-2 rounded-lg bg-neutral-800/50 backdrop-blur-lg"
            onClick={() => setOpen(!open)}
            whileTap={{ scale: 0.9 }}
          >
            <div className="space-y-1.5">
              <span className={`block h-0.5 w-6 bg-white transition-all ${open ? "rotate-45 translate-y-2" : ""}`}></span>
              <span className={`block h-0.5 w-6 bg-white transition-all ${open ? "opacity-0" : ""}`}></span>
              <span className={`block h-0.5 w-6 bg-white transition-all ${open ? "-rotate-45 -translate-y-2" : ""}`}></span>
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
            className="fixed top-16 right-0 w-[75%] h-screen bg-neutral-900/60 backdrop-blur-2xl border-l border-white/10 p-6 flex flex-col gap-6 z-40"
          >
            <Link href={`/${locale}`} className="text-lg hover:text-blue-400" onClick={() => setOpen(false)}>
              Home
            </Link>
            <Link href={`/${locale}/about`} className="text-lg hover:text-blue-400" onClick={() => setOpen(false)}>
              {t("about")}
            </Link>
            {user ? (
              <>
                <span className="text-sm text-gray-400">{user.email}</span>
                <button onClick={handleLogout} className="text-lg text-red-400 hover:text-red-300 text-left">
                  {t("logout")}
                </button>
              </>
            ) : (
              <Link href={`/${locale}/login`} className="text-lg hover:text-blue-400" onClick={() => setOpen(false)}>
                {t("login")}
              </Link>
            )}
            {/* Language switcher */}
            <button
              onClick={() => { toggleLocale(); setOpen(false); }}
              className="text-lg hover:text-blue-400 text-left"
            >
              {locale === "en" ? "切換至中文" : "Switch to EN"}
            </button>      
    </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}