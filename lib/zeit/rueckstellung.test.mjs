// Tests fuer die Liste der zurueckgestellten Aufgaben (node --test lib/zeit/rueckstellung.test.mjs)
import { test } from "node:test";
import assert from "node:assert/strict";
import { rueckstellungen, zurueckgestelltSeit } from "./rueckstellung.ts";

const a = (id, status, createdAt, history = []) => ({ id, status, createdAt, history });

test("seit dem letzten Wechsel auf Rueckfragen offen", () => {
  const t = a("1", "in_bearbeitung", "2026-10-01T08:00:00Z", [
    { at: "2026-10-02T08:00:00Z", from: "offen", to: "in_bearbeitung", by: "x" },
    { at: "2026-10-05T08:00:00Z", from: "in_bearbeitung", to: "offen", by: "x" },
    { at: "2026-10-07T08:00:00Z", from: "offen", to: "in_bearbeitung", by: "x" },
  ]);
  assert.equal(zurueckgestelltSeit(t), "2026-10-07T08:00:00Z");
});

test("ohne Verlauf gilt die Anlage", () => {
  assert.equal(zurueckgestelltSeit(a("2", "in_bearbeitung", "2026-10-03T08:00:00Z")), "2026-10-03T08:00:00Z");
});

test("nur zurueckgestellte, die aelteste Rueckstellung zuerst", () => {
  const liste = rueckstellungen([
    a("neu", "in_bearbeitung", "2026-10-10T08:00:00Z"),
    a("offen", "offen", "2026-09-01T08:00:00Z"),
    a("alt", "in_bearbeitung", "2026-10-01T08:00:00Z"),
    a("fertig", "erledigt", "2026-09-01T08:00:00Z"),
  ]);
  assert.deepEqual(liste.map((x) => x.aufgabe.id), ["alt", "neu"]);
  assert.equal(liste[0].seit, "2026-10-01T08:00:00Z");
});
