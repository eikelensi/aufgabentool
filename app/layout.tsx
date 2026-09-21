import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aufgabentool – 4wändekanzlei",
  description:
    "Internes Aufgabenmanagement: Board mit Drag-and-drop, Aufgabenpool, Pflichtnotiz, Kategorien, Eskalation und onOffice-Bezug.",
};

/**
 * Nur Huelle. Die Navigation und der Datenbestand sitzen in app/(app),
 * damit Anmeldung und Passwortseiten ohne sie auskommen - dort ist noch
 * niemand angemeldet, den eine Navigation etwas anginge.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
