// Tests fuer den Fingerabdruck einer Aufgabenzeile
// (node --experimental-strip-types --test lib/sync/fingerabdruck.test.mjs)
import { test } from "node:test";
import assert from "node:assert/strict";
import { fingerabdruck } from "./fingerabdruck.ts";

const zeile = {
  title: "Exposé prüfen",
  status: "offen",
  assignee_id: "a1",
  due_date: "2026-10-23",
  onoffice_synced_at: "2026-10-22T07:00:00.000Z",
  updated_at: "2026-10-22T07:00:00.000Z",
};

test("gleicher Inhalt, nur andere Lauf-Zeitstempel: gleicher Fingerabdruck", () => {
  const spaeter = {
    ...zeile,
    onoffice_synced_at: "2026-10-22T07:02:00.000Z",
    updated_at: "2026-10-22T07:02:00.000Z",
  };
  assert.equal(fingerabdruck(spaeter), fingerabdruck(zeile));
});

test("Reihenfolge der Felder spielt keine Rolle", () => {
  const umgestellt = {
    due_date: "2026-10-23",
    assignee_id: "a1",
    status: "offen",
    title: "Exposé prüfen",
  };
  assert.equal(fingerabdruck(umgestellt), fingerabdruck(zeile));
});

test("eine echte Aenderung aendert den Fingerabdruck", () => {
  assert.notEqual(fingerabdruck({ ...zeile, status: "erledigt" }), fingerabdruck(zeile));
  assert.notEqual(fingerabdruck({ ...zeile, assignee_id: "b2" }), fingerabdruck(zeile));
  assert.notEqual(fingerabdruck({ ...zeile, due_date: null }), fingerabdruck(zeile));
});

test("fehlendes Feld und leeres Feld sind verschieden", () => {
  const ohne = { ...zeile };
  delete ohne.due_date;
  assert.notEqual(fingerabdruck(ohne), fingerabdruck({ ...zeile, due_date: null }));
});
