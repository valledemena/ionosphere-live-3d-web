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
    "Visualizador ionosférico 3D en tiempo real: clima espacial NOAA, ionosondas GIRO, aurora OVATION y propagación HF con ray-tracing multi-salto.",
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${spaceGrotesk.variable} antialiased bg-[#02040a] text-slate-100`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
