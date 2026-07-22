import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ModeSwitcher } from "@/components/ModeSwitcher";
import { PersonaSelector } from "@/components/PersonaSelector";
import { SearchBar } from "@/components/SearchBar";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mock Understand Everything",
  description: "Interactive mock-page guidebook for any codebase",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${dmSans.variable} ${jetbrainsMono.variable}`}>
      <body>
        <div className="app-shell" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
          <header style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.75rem 1.5rem",
            borderBottom: "1px solid rgba(212, 165, 116, 0.15)",
            backgroundColor: "var(--color-surface)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <h1 style={{ fontSize: "1rem", fontWeight: 600, margin: 0, color: "var(--color-text-primary)" }}>
                Mock Understand Everything
              </h1>
              <span style={{
                fontSize: "0.75rem",
                padding: "0.125rem 0.5rem",
                borderRadius: "0.25rem",
                backgroundColor: "rgba(212, 165, 116, 0.1)",
                color: "var(--color-accent)",
              }}>
                POC
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <SearchBar />
              <ModeSwitcher />
              <PersonaSelector />
            </div>
          </header>
          <main style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
