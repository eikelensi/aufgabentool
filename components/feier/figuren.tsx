/**
 * Die Figuren, die nach einer erledigten Aufgabe durchs Bild huepfen -
 * alle selbst gezeichnet. Welche wann kommt, steht in lib/zeit/saison.ts.
 */
import type { Feierfigur } from "@/lib/zeit/saison";

export function FigurBild({ figur }: { figur: Feierfigur }) {
  switch (figur) {
    case "kuerbis":
      return <Kuerbis />;
    case "weihnachtsmann":
      return <Weihnachtsmann />;
    case "schneemann":
      return <Schneemann />;
    case "osterhase":
      return <Osterhase />;
    default:
      return <Einhorn />;
  }
}

/** Halloween: Kuerbis mit geschnitztem Gesicht, dazu eine Fledermaus. */
function Kuerbis() {
  return (
    <svg viewBox="0 0 140 120" xmlns="http://www.w3.org/2000/svg">
      {/* Fledermaus */}
      <path d="M8 22 q6 -8 12 -2 q3 -6 6 0 q3 -6 6 0 q6 -6 12 2 q-8 -2 -12 6 q-3 -3 -6 0 q-3 -3 -6 0 q-4 -8 -12 -6z" fill="#3b2a4a" />
      {/* Stiel und Blatt */}
      <path d="M68 30 C 66 20, 70 12, 78 10 L 80 15 C 75 17, 74 23, 75 31 Z" fill="#6b4a1f" stroke="#4a3212" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M78 22 C 90 12, 104 16, 104 24 C 96 22, 88 26, 80 28 Z" fill="#5aa832" stroke="#3d7a1f" strokeWidth="1.2" />
      {/* Koerper aus fuenf Rippen */}
      <ellipse cx="44" cy="72" rx="30" ry="40" fill="#e8730c" stroke="#b85500" strokeWidth="2" />
      <ellipse cx="96" cy="72" rx="30" ry="40" fill="#e8730c" stroke="#b85500" strokeWidth="2" />
      <ellipse cx="56" cy="72" rx="26" ry="42" fill="#f5891f" stroke="#b85500" strokeWidth="2" />
      <ellipse cx="84" cy="72" rx="26" ry="42" fill="#f5891f" stroke="#b85500" strokeWidth="2" />
      <ellipse cx="70" cy="72" rx="22" ry="43" fill="#ff9d33" stroke="#b85500" strokeWidth="2" />
      {/* Gesicht, von innen leuchtend */}
      <path d="M44 58 L 56 42 L 62 62 Z" fill="#ffd34d" stroke="#5a2a00" strokeWidth="3" strokeLinejoin="round" />
      <path d="M96 58 L 84 42 L 78 62 Z" fill="#ffd34d" stroke="#5a2a00" strokeWidth="3" strokeLinejoin="round" />
      <path d="M66 70 L 70 62 L 74 70 Z" fill="#ffd34d" stroke="#5a2a00" strokeWidth="2.5" strokeLinejoin="round" />
      <path
        d="M38 80 Q 70 108 102 80 L 94 82 L 90 90 L 82 84 L 76 94 L 70 86 L 64 94 L 58 84 L 50 90 L 46 82 Z"
        fill="#ffd34d"
        stroke="#5a2a00"
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Weihnachten: Weihnachtsmann mit Muetze, Bart und Geschenk. */
function Weihnachtsmann() {
  return (
    <svg viewBox="0 0 130 150" xmlns="http://www.w3.org/2000/svg">
      {/* Stiefel */}
      <path d="M40 128 h18 v14 h-24 a6 6 0 0 1 6 -14z" fill="#222" />
      <path d="M72 128 h18 a6 6 0 0 1 6 14 h-24z" fill="#222" />
      {/* Beine */}
      <rect x="42" y="112" width="16" height="20" fill="#c81d25" />
      <rect x="72" y="112" width="16" height="20" fill="#c81d25" />
      {/* Arme */}
      <ellipse cx="28" cy="88" rx="11" ry="20" fill="#c81d25" transform="rotate(25 28 88)" />
      <circle cx="20" cy="104" r="7" fill="#1f6b3a" />
      {/* Koerper */}
      <ellipse cx="65" cy="92" rx="36" ry="32" fill="#d62828" stroke="#9e1b1b" strokeWidth="2" />
      <rect x="29" y="110" width="72" height="9" rx="4" fill="#ffffff" />
      <rect x="30" y="90" width="70" height="9" fill="#222" />
      <rect x="58" y="88" width="14" height="13" rx="2" fill="none" stroke="#f2c230" strokeWidth="3" />
      {/* Geschenk im anderen Arm */}
      <ellipse cx="102" cy="84" rx="11" ry="20" fill="#c81d25" transform="rotate(-35 102 84)" />
      <rect x="100" y="66" width="24" height="22" rx="2" fill="#2a8fd6" stroke="#1d6aa3" strokeWidth="1.5" />
      <rect x="109" y="66" width="6" height="22" fill="#f2c230" />
      <path d="M112 66 q-8 -10 -10 -2 q4 4 10 2 q8 -10 10 -2 q-4 4 -10 2z" fill="#f2c230" />
      <circle cx="104" cy="96" r="7" fill="#1f6b3a" />
      {/* Kopf */}
      <circle cx="65" cy="46" r="20" fill="#f7cfae" />
      {/* Bart */}
      <path d="M43 46 C 42 74, 56 86, 65 86 C 74 86, 88 74, 87 46 C 80 56, 74 52, 65 54 C 56 52, 50 56, 43 46 Z" fill="#ffffff" stroke="#dcdcdc" strokeWidth="1.5" />
      <path d="M52 56 C 58 50, 64 54, 65 56 C 66 54, 72 50, 78 56 C 72 60, 66 58, 65 58 C 64 58, 58 60, 52 56 Z" fill="#ffffff" stroke="#dcdcdc" strokeWidth="1" />
      <circle cx="65" cy="50" r="4" fill="#e8807a" />
      <circle cx="57" cy="42" r="2.2" fill="#2b2b2b" />
      <circle cx="73" cy="42" r="2.2" fill="#2b2b2b" />
      <circle cx="52" cy="50" r="3" fill="#f2a7a0" opacity="0.7" />
      <circle cx="78" cy="50" r="3" fill="#f2a7a0" opacity="0.7" />
      {/* Muetze */}
      <path d="M44 34 C 48 10, 76 4, 92 16 C 100 22, 104 30, 106 38 L 94 34 C 90 26, 84 22, 84 30 L 86 34 Z" fill="#d62828" stroke="#9e1b1b" strokeWidth="1.5" strokeLinejoin="round" />
      <rect x="40" y="28" width="50" height="11" rx="5.5" fill="#ffffff" />
      <circle cx="106" cy="40" r="7" fill="#ffffff" />
    </svg>
  );
}

/** Winter: Schneemann mit Hut, Schal und Karottennase. */
function Schneemann() {
  return (
    <svg viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg">
      {/* Arme */}
      <path d="M36 80 L 8 62 M 18 68 L 12 58" stroke="#6b4a1f" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path d="M84 80 L 112 62 M 102 68 L 108 58" stroke="#6b4a1f" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      {/* Kugeln */}
      <circle cx="60" cy="118" r="30" fill="#ffffff" stroke="#b9d3e6" strokeWidth="2" />
      <circle cx="60" cy="78" r="23" fill="#ffffff" stroke="#b9d3e6" strokeWidth="2" />
      <circle cx="60" cy="42" r="18" fill="#ffffff" stroke="#b9d3e6" strokeWidth="2" />
      {/* Knoepfe */}
      <circle cx="60" cy="72" r="3" fill="#2b2b2b" />
      <circle cx="60" cy="84" r="3" fill="#2b2b2b" />
      <circle cx="60" cy="110" r="3.5" fill="#2b2b2b" />
      <circle cx="60" cy="124" r="3.5" fill="#2b2b2b" />
      {/* Schal */}
      <path d="M42 56 Q 60 64 78 56 L 78 62 Q 60 70 42 62 Z" fill="#d62828" />
      <path d="M70 60 L 76 80 L 68 80 L 64 62 Z" fill="#b51e1e" />
      {/* Gesicht */}
      <circle cx="54" cy="38" r="2.4" fill="#2b2b2b" />
      <circle cx="66" cy="38" r="2.4" fill="#2b2b2b" />
      <path d="M60 43 L 78 46 L 60 47 Z" fill="#f28c28" />
      <path d="M53 50 q7 5 14 0" stroke="#2b2b2b" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Hut */}
      <rect x="40" y="24" width="40" height="5" rx="2" fill="#2b2b2b" />
      <rect x="47" y="4" width="26" height="22" rx="2" fill="#2b2b2b" />
      <rect x="47" y="18" width="26" height="4" fill="#d62828" />
      {/* Schneeflocken */}
      <path d="M100 20 v12 M94 26 h12 M96 22 l8 8 M104 22 l-8 8" stroke="#8fc3ea" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 30 v8 M12 34 h8" stroke="#8fc3ea" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Ostern: Osterhase mit buntem Ei. */
function Osterhase() {
  return (
    <svg viewBox="0 0 130 140" xmlns="http://www.w3.org/2000/svg">
      {/* Ohren */}
      <ellipse cx="52" cy="26" rx="9" ry="26" fill="#d9c6b0" stroke="#a8927a" strokeWidth="1.5" transform="rotate(-12 52 26)" />
      <ellipse cx="52" cy="28" rx="4.5" ry="19" fill="#f4b6c6" transform="rotate(-12 52 28)" />
      <ellipse cx="76" cy="26" rx="9" ry="26" fill="#d9c6b0" stroke="#a8927a" strokeWidth="1.5" transform="rotate(14 76 26)" />
      <ellipse cx="76" cy="28" rx="4.5" ry="19" fill="#f4b6c6" transform="rotate(14 76 28)" />
      {/* Schwaenzchen und Koerper */}
      <circle cx="30" cy="104" r="9" fill="#ffffff" stroke="#d6d6d6" strokeWidth="1.5" />
      <ellipse cx="62" cy="100" rx="32" ry="30" fill="#d9c6b0" stroke="#a8927a" strokeWidth="1.5" />
      <ellipse cx="66" cy="106" rx="18" ry="18" fill="#f3ebe0" />
      {/* Fuesse */}
      <ellipse cx="46" cy="128" rx="14" ry="7" fill="#d9c6b0" stroke="#a8927a" strokeWidth="1.5" />
      <ellipse cx="80" cy="128" rx="14" ry="7" fill="#d9c6b0" stroke="#a8927a" strokeWidth="1.5" />
      {/* Kopf */}
      <circle cx="64" cy="62" r="22" fill="#d9c6b0" stroke="#a8927a" strokeWidth="1.5" />
      <circle cx="56" cy="58" r="2.6" fill="#2b2b2b" />
      <circle cx="72" cy="58" r="2.6" fill="#2b2b2b" />
      <ellipse cx="64" cy="66" rx="3.2" ry="2.4" fill="#e8809a" />
      <path d="M64 68 v4 M64 72 q-4 3 -7 0 M64 72 q4 3 7 0" stroke="#7a5c48" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M46 66 h-12 M46 70 h-11 M82 66 h12 M82 70 h11" stroke="#a8927a" strokeWidth="1" strokeLinecap="round" />
      <circle cx="50" cy="68" r="3" fill="#f4b6c6" opacity="0.7" />
      <circle cx="78" cy="68" r="3" fill="#f4b6c6" opacity="0.7" />
      {/* Ei in den Pfoten */}
      <ellipse cx="98" cy="96" rx="15" ry="19" fill="#7cc6f2" stroke="#3f8fc4" strokeWidth="1.5" />
      <path d="M84 92 q7 -6 14 0 t14 0" stroke="#ffd34d" strokeWidth="4" fill="none" />
      <path d="M84 102 q7 6 14 0 t14 0" stroke="#ff7aa8" strokeWidth="4" fill="none" />
      <circle cx="98" cy="84" r="2.2" fill="#ffffff" />
      <ellipse cx="88" cy="100" rx="7" ry="5" fill="#d9c6b0" stroke="#a8927a" strokeWidth="1.2" />
    </svg>
  );
}

/** Fruehling und Sommer: Einhorn mit Regenbogenmaehne. */
function Einhorn() {
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
