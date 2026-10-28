import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Ionosphere Live 3D — Web Explorer",
  description:
    "Real-time 3D ionospheric visualizer: NOAA space weather, GIRO ionosondes, OVATION aurora and HF propagation with multi-hop ray tracing.",
  icons: {
    icon: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${spaceGrotesk.variable} antialiased bg-[#02040a] text-slate-100`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
