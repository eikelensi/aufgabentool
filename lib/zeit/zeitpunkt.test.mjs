// Tests fuer gleicherZeitpunkt (node --test lib/zeit/zeitpunkt.test.mjs)
import { test } from "node:test";
import assert from "node:assert/strict";
import { gleicherZeitpunkt } from "./zeitpunkt.ts";

test("Asana schreibt Z, Postgres liefert +00:00 - derselbe Zeitpunkt", () => {
  assert.equal(gleicherZeitpunkt("2026-10-20T21:06:47.264Z", "2026-10-20T21:06:47.264+00:00"), true);
});

test("verschiedene Zeitpunkte bleiben verschieden", () => {
  assert.equal(gleicherZeitpunkt("2026-10-20T21:06:47.264Z", "2026-10-20T21:06:48.000+00:00"), false);
});

test("fehlt einer, gilt das als Aenderung - ausser beide fehlen", () => {
  assert.equal(gleicherZeitpunkt("2026-10-20T21:06:47.264Z", null), false);
  assert.equal(gleicherZeitpunkt(undefined, "2026-10-20T21:06:47.264+00:00"), false);
  assert.equal(gleicherZeitpunkt(null, null), true);
});

test("unlesbarer Text wird nur mit sich selbst gleich", () => {
  assert.equal(gleicherZeitpunkt("kaputt", "kaputt"), true);
  assert.equal(gleicherZeitpunkt("kaputt", "2026-10-20T21:06:47.264Z"), false);
});
