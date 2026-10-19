-- at_65: Mails je Person abschalten - das stellt allein der Admin ein.
--
-- 1. Niemand stellt mehr selbst um.
update public.mail_regeln set nutzer_darf_aendern = false;

-- 2. Ein "aus" je Person gilt immer, unabhaengig von nutzer_darf_aendern.
--    Hausregel aus = fuer alle aus; ein persoenliches "an" hebt das nicht auf.
--    Die Zeiten (Tage, Wiederholung, Stunde) bleiben wie bisher geregelt.
create or replace view public.v_mail_regel_je_person as
select p.id as profile_id,
       r.kind,
       r.art,
       (r.aktiv and coalesce(e.aktiv, true)) as aktiv,
       case when r.nutzer_darf_aendern then coalesce(e.tage_bis, r.tage_bis) else r.tage_bis end as tage_bis,
       case when r.nutzer_darf_aendern then coalesce(e.wiederholen_tage, r.wiederholen_tage) else r.wiederholen_tage end as wiederholen_tage,
       case when r.nutzer_darf_aendern then coalesce(e.stunde, r.stunde) else r.stunde end as stunde,
       r.nutzer_darf_aendern,
       ((e.aktiv is false) or (r.nutzer_darf_aendern and e.profile_id is not null)) as weicht_ab
from public.profiles p
cross join public.mail_regeln r
left join public.mail_einstellungen e on e.profile_id = p.id and e.kind = r.kind
where p.is_active;

-- 3. Die Eskalation geht an zwei Menschen (Bearbeiter und Ersteller).
--    Ob sie faellig ist, entscheidet deshalb nur die Hausregel; wer sie
--    persoenlich abgeschaltet hat, prueft der Versand je Empfaenger.
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
  and t.created_at < now() - make_interval(days => coalesce(v.tage_bis, 7))
  and (t.escalation_7d_sent_at is null
       or (v.wiederholen_tage > 0
           and t.escalation_7d_sent_at < now() - make_interval(days => v.wiederholen_tage)));
