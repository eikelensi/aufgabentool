// Tests fuer die Figur je Jahreszeit (node --test lib/zeit/saison.test.mjs)
import { test } from "node:test";
import assert from "node:assert/strict";
import { figurZurJahreszeit } from "./saison.ts";

const am = (iso) => figurZurJahreszeit(new Date(iso));

test("Oktober und November: Kuerbis", () => {
  assert.equal(am("2026-10-01T08:00:00"), "kuerbis");
  assert.equal(am("2026-11-30T20:00:00"), "kuerbis");
});

test("Dezember: Weihnachtsmann", () => {
  assert.equal(am("2026-12-01T08:00:00"), "weihnachtsmann");
  assert.equal(am("2026-12-31T23:00:00"), "weihnachtsmann");
});

test("Januar, Februar: Schneemann; Maerz, April: Osterhase", () => {
  assert.equal(am("2027-01-02T08:00:00"), "schneemann");
  assert.equal(am("2027-02-28T08:00:00"), "schneemann");
  assert.equal(am("2027-03-01T08:00:00"), "osterhase");
  assert.equal(am("2027-04-30T08:00:00"), "osterhase");
});

test("Mai bis September: Einhorn", () => {
  assert.equal(am("2027-05-01T08:00:00"), "einhorn");
  assert.equal(am("2027-09-30T08:00:00"), "einhorn");
});
