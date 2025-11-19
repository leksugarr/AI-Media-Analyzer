export { Metadata } from "next";
import "./global.css";

export const Metadata = {
  title: "AI Media Analyzer",
  description: "Summarize & analyze articles with AI",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-black text-white font-sans">
        <header className="p-4 flex justify-between items-center bg-gray-800/60 backdrop-blur-md">
          <h1 className="text-xl font-bold">AI Media Analyzer</h1>
        </header>
        <main className="p-6">{children}</main>
      </body>
    </html>
  );
}
