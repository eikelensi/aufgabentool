"use client";

import { useStore } from "@/lib/store";

export default function Liste() {
  const { verlinkungen } = useStore();

  // Abgeschaltete stehen in der Verwaltung, nicht hier.
  const sichtbar = [...verlinkungen]
    .filter((v) => v.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div style={{ maxWidth: 900 }}>
      <header className="mb-4">
        <h1 className="text-lg font-semibold">Verlinkungen</h1>
        <p className="muted mt-0.5 text-xs leading-relaxed">
          Die übrigen Anwendungen des Hauses. Jede öffnet sich in einem neuen Tab.
        </p>
      </header>

      {sichtbar.length === 0 ? (
        <p className="muted line rounded-lg border border-dashed p-4 text-xs">
          Hier ist noch nichts hinterlegt. Einzutragen in der Verwaltung unter
          „Verlinkungen“.
        </p>
      ) : (
        <ul className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
          {sichtbar.map((v) => (
            <li key={v.id}>
              <a
                href={v.url}
                target="_blank"
                /* noreferrer gehoert dazu: ohne das kann die geoeffnete
                   Seite ueber window.opener auf diesen Tab zugreifen. */
                rel="noreferrer noopener"
                className="panel line block h-full rounded-lg border p-3 transition"
                style={{ textDecoration: "none" }}
              >
                <span className="flex items-baseline gap-2">
                  {v.icon ? <span aria-hidden>{v.icon}</span> : null}
                  <strong className="text-sm">{v.name}</strong>
                </span>
                {v.beschreibung ? (
                  <span className="muted mt-1 block text-[11px] leading-relaxed">
                    {v.beschreibung}
                  </span>
                ) : null}
                <span
                  className="muted mt-2 block truncate text-[10px]"
                  style={{ color: "var(--color-ci-500)" }}
                  title={v.url}
                >
                  {v.url.replace(/^https?:\/\//, "")} ↗
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
