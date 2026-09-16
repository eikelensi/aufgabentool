import type { Metadata } from "next";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import Shell from "@/components/Shell";

export const metadata: Metadata = {
  title: "Aufgabentool – 4wändekanzlei",
  description:
    "Klickbarer Prototyp des internen Aufgabenmanagements: Board mit Drag-and-drop, Aufgabenpool, Pflichtnotiz, Kategorien, Eskalation und onOffice-Bezug.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body>
        <StoreProvider>
          <Shell>{children}</Shell>
        </StoreProvider>
      </body>
    </html>
  );
}
