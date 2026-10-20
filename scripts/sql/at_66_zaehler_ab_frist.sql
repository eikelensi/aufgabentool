-- at_66: Erinnerung und Eskalation zaehlen bei einer Frist in der Zukunft erst ab dem Fristtag.
--
-- Bisher lief die Uhr ab der Anlage (created_at). Eine frueh angelegte Aufgabe mit spaeter
-- Frist bekam so Erinnerung und Eskalation, bevor sie ueberhaupt dran war. Jetzt zaehlt
-- der spaetere der beiden Zeitpunkte: Anlage oder Beginn des Fristtags (Ortszeit).
-- greatest() uebergeht ein leeres due_date, ohne Frist bleibt es also bei der Anlage.
-- Dieselbe Regel steht in lib/zeit/zaehler.ts (Zaehler auf der Karte, Tage im Mailtext).
--
-- Reihenfolge: NACH at_65 einspielen (at_65 legt v_faellige_eskalationen neu an,
-- diese Fassung baut darauf auf) und erst, wenn der Code ausgeliefert ist.

create or replace view public.v_faellige_erinnerungen as
select t.id, t.title, t.assignee_id, t.creator_id, t.created_at, v.stunde
from public.tasks t
join public.v_mail_regel_je_person v
  on v.profile_id = t.assignee_id and v.kind = 'erinnerung_3t'
where t.status = 'offen'
  and not t.is_private
  and t.assignee_id is not null
  and t.visible_from <= current_date
  and v.aktiv
  and greatest(t.created_at, t.due_date::timestamp at time zone 'Europe/Berlin')
      < now() - make_interval(days => coalesce(v.tage_bis, 3))
  and (t.reminder_3d_sent_at is null
       or (v.wiederholen_tage > 0
           and t.reminder_3d_sent_at < now() - make_interval(days => v.wiederholen_tage)));

create or replace view public.v_faellige_eskalationen as
select t.id, t.title, t.assignee_id, t.creator_id, t.created_at, v.stunde
from public.tasks t
join public.v_mail_regel_je_person v
  on v.profile_id = coalesce(t.assignee_id, t.creator_id) and v.kind = 'eskalation_7t'
join public.mail_regeln r on r.kind = 'eskalation_7t'
where t.status = 'offen'
  and not t.is_private
  and t.visible_from <= current_date
  and r.aktiv
  and greatest(t.created_at, t.due_date::timestamp at time zone 'Europe/Berlin')
      < now() - make_interval(days => coalesce(v.tage_bis, 7))
  and (t.escalation_7d_sent_at is null
       or (v.wiederholen_tage > 0
           and t.escalation_7d_sent_at < now() - make_interval(days => v.wiederholen_tage)));
