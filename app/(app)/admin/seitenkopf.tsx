/**
 * Ein Kopf fuer jede Verwaltungsseite.
 *
 * Klingt nach Kleinkram, ist aber der Grund, warum die Verwaltung
 * vorher unruhig wirkte: jede Seite fing anders an - mal mit einer
 * Ueberschrift, mal mit einer Kachel, mal mit nichts. Hier steht
 * einmal, wie es aussieht, und alle halten sich daran.
 */
export default function Seitenkopf({
  titel,
  text,
}: {
  titel: string;
  text: string;
}) {
  return (
    <header className="mb-3">
      <h2 className="text-base font-semibold">{titel}</h2>
      <p className="muted mt-0.5 max-w-[80ch] text-[12px] leading-relaxed">{text}</p>
    </header>
  );
}
