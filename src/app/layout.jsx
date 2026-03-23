import "./global.css";
import { Inter } from "next/font/google";
import Navbar from "@/components/Navbar";
import AnimatedLayout from "@/components/AnimatedLayout";
import { AuthProvider } from "@/context/AuthContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "AI Media Analyzer",
  description: "Paste articles, get AI summaries and bias analysis",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <Navbar />
          <AnimatedLayout>{children}</AnimatedLayout>
        </AuthProvider>
      </body>
    </html>
  );
}