import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aufgabentool – 4wändekanzlei",
  description:
    "Internes Aufgabenmanagement: Board mit Drag-and-drop, Aufgabenpool, Pflichtnotiz, Kategorien, Eskalation und onOffice-Bezug.",
};

/**
 * Setzt den Modus, bevor das erste Bild steht.
 *
 * Ohne das laedt die Seite hell, und wer den dunklen Modus eingestellt
 * hat, bekommt fuer den Bruchteil einer Sekunde eine weisse Flaeche ins
 * Gesicht - nachts der unangenehmste Teil der ganzen Anwendung. Das
 * Skript muss deshalb blockierend im Kopf stehen und darf nichts
 * nachladen; es sind drei Zeilen, die vor allem anderen laufen.
 *
 * Die Zeichenkette ist fest und enthaelt nichts von aussen.
 */
const MODUS_SKRIPT = `(function(){try{
var g=localStorage.getItem("aufgabentool-theme");
var d=g?g==="dark":matchMedia("(prefers-color-scheme: dark)").matches;
document.documentElement.dataset.theme=d?"dark":"light";
}catch(e){}})();`;

/**
 * Nur Huelle. Die Navigation und der Datenbestand sitzen in app/(app),
 * damit Anmeldung und Passwortseiten ohne sie auskommen - dort ist noch
 * niemand angemeldet, den eine Navigation etwas anginge.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: MODUS_SKRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
