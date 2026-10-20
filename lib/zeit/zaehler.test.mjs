// Tests fuer den Zaehler "X Tage offen" (node --test lib/zeit/zaehler.test.mjs)
import { test } from "node:test";
import assert from "node:assert/strict";
import { tageOffen, zaehlerStart } from "./zaehler.ts";

const jetzt = new Date("2026-10-20T10:00:00");

test("ohne Frist zaehlt ab der Anlage", () => {
  assert.equal(tageOffen({ createdAt: "2026-10-10T09:00:00", dueDate: null }, jetzt), 10);
});

test("Frist in der Zukunft: noch kein Zaehler", () => {
  assert.equal(tageOffen({ createdAt: "2026-10-01T09:00:00", dueDate: "2026-10-25" }, jetzt), null);
});

test("am Fristtag beginnt der Zaehler bei 0", () => {
  assert.equal(tageOffen({ createdAt: "2026-10-01T09:00:00", dueDate: "2026-10-20" }, jetzt), 0);
});

test("nach der Frist zaehlt ab der Frist, nicht ab der Anlage", () => {
  assert.equal(tageOffen({ createdAt: "2026-09-01T09:00:00", dueDate: "2026-10-12" }, jetzt), 8);
});

test("Frist vor der Anlage: es zaehlt die Anlage", () => {
  assert.equal(zaehlerStart({ createdAt: "2026-10-15T09:00:00", dueDate: "2026-10-01" }).toISOString(), new Date("2026-10-15T09:00:00").toISOString());
});
