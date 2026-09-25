"use client";

/**
 * Symbole oder Woerter im Hauptmenue.
 *
 * Es gibt keine richtige Antwort. Symbole sparen Platz und sind auf
 * einem schmalen Bildschirm schneller zu treffen; Woerter muss man
 * nicht raten. Also einstellbar - und zwar fuer alle gemeinsam, wie
 * die Farben: ein Menue, das bei jedem anders aussieht, kann niemand
 * jemandem erklaeren.
 */

import { useStore } from "@/lib/store";
import { MENUE_STIL_LABEL, type MenueStil } from "@/lib/types";

const STILE = Object.keys(MENUE_STIL_LABEL) as MenueStil[];

export default function MenueStilFormular() {
  const { isAdmin, settings, updateSettings } = useStore();
  if (!isAdmin) return null;

  return (
    <section className="panel mb-4 p-4" style={{ maxWidth: 720 }}>
      <h3 className="mb-1 text-sm font-semibold">Hauptmenü</h3>
      <p className="muted mb-3 text-[11px] leading-relaxed">
        Gilt für alle. Bei „Nur Symbole“ hängt der Name als Hinweis am Knopf – sonst müsste
        man raten.
      </p>

      <div className="flex flex-wrap gap-2">
        {STILE.map((stil) => (
          <button
            key={stil}
            type="button"
            className="btn"
            onClick={() => void updateSettings({ menueStil: stil })}
            style={
              settings.menueStil === stil
                ? {
                    background: "var(--color-ci-400)",
                    borderColor: "var(--color-ci-400)",
                    color: "var(--auf-akzent)",
                    fontWeight: 600,
                  }
                : undefined
            }
          >
            {MENUE_STIL_LABEL[stil]}
          </button>
        ))}
      </div>
    </section>
  );
}
