import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${newsreader.variable} antialiased bg-stone-50 text-neutral-900 selection:bg-blue-500/20 selection:text-blue-900`}
      >
        <StudioProvider>
          <TooltipProvider>
            {children}
            <Toaster 
              theme="light" 
              toastOptions={{
                className: "rounded-2xl border-black/5 shadow-xl font-sans text-sm",
              }}
            />
          </TooltipProvider>
        </StudioProvider>
      </body>
    </html>
  );
}
