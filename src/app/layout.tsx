import type { Metadata } from "next";
import "./globals.css";
import { TopBar } from "@/components/TopBar";
import { Toasts } from "@/components/Toasts";
import { AuthModal } from "@/components/AuthModal";
import { WsBootstrap } from "@/components/WsBootstrap";
import { MobileNav } from "@/components/MobileNav";
import { MobileSheet } from "@/components/MobileSheet";
import { WalletModal } from "@/components/WalletModal";
import { MatchDetailModal } from "@/components/MatchDetailModal";

export const metadata: Metadata = {
  title: "BrasilBet — Apostas esportivas ao vivo",
  description:
    "BrasilBet: apostas esportivas com odds em tempo real, cashout e as melhores promoções.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen font-sans text-slate-100 antialiased">
        <WsBootstrap />
        <TopBar />
        {children}
        <div className="h-20 lg:hidden" aria-hidden />
        <Toasts />
        <AuthModal />
        <WalletModal />
        <MatchDetailModal />
        <MobileSheet />
        <MobileNav />
      </body>
    </html>
  );
}
