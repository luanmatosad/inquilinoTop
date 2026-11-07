import type { Metadata } from "next";
import localFont from "next/font/local";
import Header from "@/components/Header";
import AppSidebar from "@/components/AppSidebar";
import { AppShell } from "@/components/AppShell";
import { ThemeProvider } from "@/components/theme-provider";
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

// Space Mono não é variável: só existem os pesos 400 e 700.
const spaceMono = localFont({
  variable: "--font-space-mono",
  src: [
    {
      path: "../../node_modules/@fontsource/space-mono/files/space-mono-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource/space-mono/files/space-mono-latin-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
  ],
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
    // suppressHydrationWarning: next-themes ajusta a classe do <html> antes da hidratação.
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`${urbanist.variable} ${spaceMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>
          <AppShell sidebar={<AppSidebar />} header={<Header />}>
            {children}
          </AppShell>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}