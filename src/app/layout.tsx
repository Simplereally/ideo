import type { Metadata, Viewport } from "next";
import { Inter, Newsreader } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { ErrorSuppressor } from "@/components/error-suppressor";
import { StudioProvider } from "@/lib/store";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ideo",
  description: "Next generation image studio",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${inter.variable} ${newsreader.variable} antialiased selection:bg-blue-500/20 selection:text-blue-900 dark:selection:bg-blue-400/30 dark:selection:text-blue-100`}
      >
        <ErrorSuppressor />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <StudioProvider>
            <TooltipProvider>
              {children}
              <Toaster />
            </TooltipProvider>
          </StudioProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
