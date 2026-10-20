-- at_67: Startseite je Person - das stellt der Admin in der Nutzerverwaltung ein.
--
-- leer = wie bisher nach Rolle (ab Qualitaetsmanagement Dashboard, sonst Mein Tag).
-- 'dashboard' gilt nur, wenn die Rolle das Dashboard auch sehen darf;
-- die Startseite prueft das selbst und faellt sonst auf Mein Tag zurueck.
--
-- Reihenfolge: erst den Code ausliefern, dann einspielen. Der Code kommt
-- ohne die Spalte zurecht (dann gilt ueberall die Regel nach Rolle).

alter table public.profiles
  add column if not exists startseite text
  check (startseite in ('dashboard', 'mein-tag'));
