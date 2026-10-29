import type { Metadata } from "next";
import { Urbanist, Geist_Mono } from "next/font/google";
import Header from "@/components/Header";
import { AppShell } from "@/components/AppShell";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const urbanist = Urbanist({
  variable: "--font-urbanist",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Inquilino Top",
  description: "Gestão de imóveis simples e eficiente",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" data-theme="light">
      <body
        className={`${urbanist.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <AppShell header={<Header />}>{children}</AppShell>
        <Toaster />
      </body>
    </html>
  );
}