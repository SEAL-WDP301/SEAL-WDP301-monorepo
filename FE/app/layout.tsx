import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { SnackbarProvider } from "../components/providers/snackbar-provider";
import { QueryProvider } from "../components/providers/query-provider";
import { ThemeProvider } from "../components/providers/theme-provider";
import { ScrollFloatProvider } from "../components/ScrollFloat";
import { SplashCursorGate } from "../components/SplashCursorGate";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "SEAL",
  description: "Software Engineering Agile League",
  icons: {
    icon: "/brand/seal-emblem-512.png",
    apple: "/brand/seal-emblem-512.png",
  },
};

import { SseProvider } from "../components/providers/sse-provider";
import { AuthProvider } from "../components/providers/auth-provider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable}`}
      suppressHydrationWarning
      data-scroll-behavior="smooth"
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <SplashCursorGate />
        <QueryProvider>
          <ThemeProvider>
            <SnackbarProvider>
              <AuthProvider>
                <SseProvider>
                  <ScrollFloatProvider>{children}</ScrollFloatProvider>
                </SseProvider>
              </AuthProvider>
            </SnackbarProvider>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
