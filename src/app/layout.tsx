import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { NextAuthProvider } from "@/components/providers/session-provider";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";

// Fuentes self-hosted en public/fonts/ (variable, subset latin). Evita
// dependencia de fonts.googleapis.com en build.
const inter = localFont({
  src: "../../public/fonts/Inter-Variable-latin.woff2",
  variable: "--font-inter",
  display: "swap",
  weight: "100 900",
});
const spaceGrotesk = localFont({
  src: "../../public/fonts/SpaceGrotesk-Variable-latin.woff2",
  variable: "--font-space-grotesk",
  display: "swap",
  weight: "300 700",
});

export const metadata: Metadata = {
  title: "EVOBIKE POS",
  description: "Punto de venta inteligente para EVOBIKE",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${inter.variable} ${spaceGrotesk.variable}`}
    >
      <body
        className="antialiased bg-[var(--surface)] text-[var(--on-surf)] transition-colors duration-200"
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange={false}>
          <NextAuthProvider>
            {children}
            <Toaster />
          </NextAuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
