"use client";

import { useEffect, useState } from "react";

/**
 * Ein Einhorn huepft quer durchs Bild, sobald eine Aufgabe erledigt ist.
 *
 * Ausgeloest von moveTask im Store (Ereignis "aufgabe-erledigt"). Es
 * liegt ueber allem, faengt aber keine Klicks ab und verschwindet nach
 * gut zwei Sekunden von selbst. Wer im System "Bewegung reduzieren"
 * eingestellt hat, bekommt es nicht zu sehen.
 */
const DAUER_MS = 2600;

export default function Einhorn() {
  const [laeufe, setLaeufe] = useState<number[]>([]);

  useEffect(() => {
    const ruhig = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const los = () => {
      if (ruhig) return;
      const id = Date.now() + Math.random();
      setLaeufe((alt) => [...alt.slice(-2), id]);
      window.setTimeout(() => setLaeufe((alt) => alt.filter((x) => x !== id)), DAUER_MS + 100);
    };
    window.addEventListener("aufgabe-erledigt", los);
    return () => window.removeEventListener("aufgabe-erledigt", los);
  }, []);

  if (laeufe.length === 0) return null;

  return (
    <div aria-hidden className="einhorn-buehne">
      <style>{STIL}</style>
      {laeufe.map((id) => (
        <div key={id} className="einhorn-lauf">
          <div className="einhorn-sprung">
            <EinhornBild />
          </div>
        </div>
      ))}
    </div>
  );
}

const STIL = `
.einhorn-buehne { position: fixed; inset: 0; pointer-events: none; z-index: 9999; overflow: hidden; }
.einhorn-lauf { position: absolute; bottom: 8%; left: 0; animation: einhorn-rennen ${DAUER_MS}ms linear forwards; }
.einhorn-sprung { animation: einhorn-huepfen ${DAUER_MS / 4}ms ease-in-out infinite; }
.einhorn-sprung svg { width: 110px; height: auto; display: block; filter: drop-shadow(0 4px 6px rgba(0,0,0,.15)); }
@keyframes einhorn-rennen { from { transform: translateX(-140px); } to { transform: translateX(calc(100vw + 20px)); } }
@keyframes einhorn-huepfen {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-70px) rotate(-8deg); }
}
`;

/** Selbst gezeichnet: Koerper, Maehne in Regenbogenfarben, goldenes Horn. */
function EinhornBild() {
  return (
    <svg viewBox="0 0 120 90" xmlns="http://www.w3.org/2000/svg">
      {/* Regenbogen-Schweif */}
      <path d="M22 40 C 4 36, 2 52, 8 60" stroke="#ff5a5f" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M22 44 C 8 42, 6 56, 12 63" stroke="#ffb400" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M22 48 C 12 48, 10 60, 16 66" stroke="#4cc76a" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M22 52 C 16 54, 14 63, 20 68" stroke="#4a90e2" strokeWidth="5" fill="none" strokeLinecap="round" />
      {/* Beine */}
      <rect x="30" y="56" width="7" height="22" rx="3" fill="#f3eefa" stroke="#c9bde0" strokeWidth="1.5" transform="rotate(18 33 56)" />
      <rect x="44" y="58" width="7" height="20" rx="3" fill="#f3eefa" stroke="#c9bde0" strokeWidth="1.5" transform="rotate(-14 47 58)" />
      <rect x="64" y="58" width="7" height="20" rx="3" fill="#f3eefa" stroke="#c9bde0" strokeWidth="1.5" transform="rotate(16 67 58)" />
      <rect x="76" y="56" width="7" height="22" rx="3" fill="#f3eefa" stroke="#c9bde0" strokeWidth="1.5" transform="rotate(-20 79 56)" />
      {/* Koerper */}
      <ellipse cx="55" cy="48" rx="34" ry="16" fill="#ffffff" stroke="#c9bde0" strokeWidth="1.5" />
      {/* Hals und Kopf */}
      <path d="M78 42 L 90 18 L 102 22 L 92 48 Z" fill="#ffffff" stroke="#c9bde0" strokeWidth="1.5" strokeLinejoin="round" />
      <ellipse cx="102" cy="24" rx="13" ry="9" fill="#ffffff" stroke="#c9bde0" strokeWidth="1.5" transform="rotate(20 102 24)" />
      <circle cx="104" cy="21" r="1.8" fill="#3a3352" />
      <ellipse cx="111" cy="29" rx="2.5" ry="1.6" fill="#ffc6d9" />
      {/* Horn */}
      <path d="M97 15 L 106 0 L 101 17 Z" fill="#ffd34d" stroke="#e0a800" strokeWidth="1" strokeLinejoin="round" />
      {/* Maehne */}
      <path d="M92 14 C 84 16, 82 24, 86 28" stroke="#ff5a5f" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M90 22 C 82 26, 80 32, 84 36" stroke="#ffb400" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M88 30 C 80 34, 78 40, 82 44" stroke="#4a90e2" strokeWidth="4" fill="none" strokeLinecap="round" />
      {/* Funkeln */}
      <path d="M60 14 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="#ffd34d" />
      <path d="M30 22 l1.5 3.5 3.5 1.5 -3.5 1.5 -1.5 3.5 -1.5 -3.5 -3.5 -1.5 3.5 -1.5z" fill="#ff9ecf" />
    </svg>
  );
}
