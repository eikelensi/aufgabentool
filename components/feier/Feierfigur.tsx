"use client";

import { useEffect, useState } from "react";
import { figurZurJahreszeit, type Feierfigur as Figur } from "@/lib/zeit/saison";
import { FigurBild } from "./figuren";

/**
 * Eine Figur huepft quer durchs Bild, sobald eine Aufgabe erledigt ist -
 * je nach Jahreszeit eine andere (Kuerbis, Weihnachtsmann, Schneemann,
 * Osterhase, Einhorn; siehe lib/zeit/saison.ts).
 *
 * Ausgeloest von moveTask im Store (Ereignis "aufgabe-erledigt"). Sie
 * liegt ueber allem, faengt aber keine Klicks ab und verschwindet nach
 * gut drei Sekunden von selbst. Wer im System "Bewegung reduzieren"
 * eingestellt hat, bekommt sie nicht zu sehen.
 */
const DAUER_MS = 3200;

export default function Feierfigur() {
  const [laeufe, setLaeufe] = useState<{ id: number; figur: Figur }[]>([]);

  useEffect(() => {
    const ruhig = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const los = () => {
      if (ruhig) return;
      const id = Date.now() + Math.random();
      setLaeufe((alt) => [...alt.slice(-2), { id, figur: figurZurJahreszeit() }]);
      window.setTimeout(() => setLaeufe((alt) => alt.filter((x) => x.id !== id)), DAUER_MS + 100);
    };
    window.addEventListener("aufgabe-erledigt", los);
    return () => window.removeEventListener("aufgabe-erledigt", los);
  }, []);

  if (laeufe.length === 0) return null;

  return (
    <div aria-hidden className="feier-buehne">
      <style>{STIL}</style>
      {laeufe.map(({ id, figur }) => (
        <div key={id} className="feier-lauf">
          <div className="feier-sprung">
            <FigurBild figur={figur} />
          </div>
        </div>
      ))}
    </div>
  );
}

const STIL = `
.feier-buehne { position: fixed; inset: 0; pointer-events: none; z-index: 9999; overflow: hidden; }
.feier-lauf { position: absolute; bottom: 6%; left: 0; animation: feier-rennen ${DAUER_MS}ms linear forwards; }
.feier-sprung { animation: feier-huepfen ${DAUER_MS / 4}ms ease-in-out infinite; }
.feier-sprung svg { width: clamp(150px, 16vw, 240px); height: auto; display: block; filter: drop-shadow(0 6px 8px rgba(0,0,0,.18)); }
@keyframes feier-rennen { from { transform: translateX(-260px); } to { transform: translateX(calc(100vw + 20px)); } }
@keyframes feier-huepfen {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-120px) rotate(-8deg); }
}
`;
