import "../global.css";
import { Inter } from "next/font/google";
import Navbar from "@/components/Navbar";
import AnimatedLayout from "@/components/AnimatedLayout";
import { AuthProvider } from "@/context/AuthContext";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "AI Opinion Analysis System",
  description: "Automated opinion monitoring platform — integrating news and social media with AI sentiment analysis, topic modeling and trend prediction.",
  keywords: ["opinion analysis", "sentiment analysis", "AI", "news monitoring", "topic modeling"],
  openGraph: {
    title: "AI Opinion Analysis System",
    description: "AI-powered opinion monitoring across news and social media.",
    type: "website",
  },
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📊</text></svg>",
  },
};

export default async function RootLayout({ children, params }) {
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className={inter.className}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AuthProvider>
            <Navbar />
            <AnimatedLayout>{children}</AnimatedLayout>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}