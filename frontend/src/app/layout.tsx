import type { Metadata } from "next";
import localFont from "next/font/local";
import Header from "@/components/Header";
import { AppShell } from "@/components/AppShell";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Fontes self-hosted (pacotes @fontsource-variable): next/font/google baixa a fonte em tempo de
// execução e quebra o `next dev` em ambientes sem acesso à internet, como o container.
const urbanist = localFont({
  variable: "--font-urbanist",
  src: "../../node_modules/@fontsource-variable/urbanist/files/urbanist-latin-wght-normal.woff2",
  weight: "100 900",
  display: "swap",
});

const geistMono = localFont({
  variable: "--font-geist-mono",
  src: "../../node_modules/@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2",
  weight: "100 900",
  display: "swap",
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