"use client";

/**
 * Symbole oder Woerter im Hauptmenue - je Gruppe.
 *
 * Es gibt keine richtige Antwort, und sie faellt auch nicht fuer alle
 * gleich aus. Symbole sparen Platz und sind schneller zu treffen,
 * wenn man sie kennt; Woerter muss man nicht raten. Wer den ganzen
 * Tag im Tool arbeitet, kennt sie nach zwei Tagen - wer dreimal die
 * Woche hereinschaut, nie.
 *
 * Eingestellt wird trotzdem zentral und nicht je Person: ein Menue,
 * das bei jedem anders aussieht, kann niemand jemandem erklaeren.
 * Drei Gruppen sind der Mittelweg.
 */

import { useStore } from "@/lib/store";
import {
  MENUE_GRUPPE_LABEL,
  MENUE_STIL_LABEL,
  type MenueGruppe,
  type MenueStil,
} from "@/lib/types";

const STILE = Object.keys(MENUE_STIL_LABEL) as MenueStil[];
const GRUPPEN = Object.keys(MENUE_GRUPPE_LABEL) as MenueGruppe[];

export default function MenueStilFormular() {
  const { isAdmin, settings, updateSettings } = useStore();
  if (!isAdmin) return null;

  return (
    <section className="panel mb-4 p-4" style={{ maxWidth: 720 }}>
      <h3 className="mb-1 text-sm font-semibold">Hauptmenü</h3>
      <p className="muted mb-3 text-[11px] leading-relaxed">
        Je Gruppe getrennt: wer täglich damit arbeitet, kennt die Symbole nach zwei Tagen
        und will den Platz; wer dreimal die Woche hereinschaut, braucht die Wörter. Bei
        „Nur Symbole“ hängt der Name als Hinweis am Knopf – sonst müsste man raten.
      </p>

      <div className="flex flex-col gap-2.5">
        {GRUPPEN.map((gruppe) => (
          <div key={gruppe} className="flex flex-wrap items-center gap-2">
            <span className="w-[260px] shrink-0 text-[12px] font-medium">
              {MENUE_GRUPPE_LABEL[gruppe]}
            </span>
            {STILE.map((stil) => (
              <button
                key={stil}
                type="button"
                className="btn"
                style={
                  settings.menueStilJeGruppe[gruppe] === stil
                    ? {
                        background: "var(--color-ci-400)",
                        borderColor: "var(--color-ci-400)",
                        color: "var(--auf-akzent)",
                        fontWeight: 600,
                      }
                    : undefined
                }
                onClick={() =>
                  void updateSettings({
                    menueStilJeGruppe: { ...settings.menueStilJeGruppe, [gruppe]: stil },
                  })
                }
              >
                {MENUE_STIL_LABEL[stil]}
              </button>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
