-- Die beiden Statusmails an den zugeordneten Kollegen.
--
-- ERST AUSROLLEN, DANN EINSPIELEN. Die Vorlagen stehen in der
-- Datenbank und wirken sofort; {{rahmen}} und {{aufgabe}} fuellt aber
-- erst die neue Fassung von app/api/mail/aufgabe/route.ts. Wer das
-- hier vorher einspielt, verschickt Mails, in denen die Platzhalter
-- ersatzlos gestrichen sind - render() entfernt, was es nicht kennt.
--
-- Die Texte lassen sich danach in der Verwaltung weiter aendern;
-- diese Datei ist der Ausgangsstand, nicht die Wahrheit.

update email_templates set
  subject = 'Erledigt: {{aufgabe}}',
  body = $t$Hallo {{empfaenger}},

die folgende Aufgabe ist erledigt.

{{rahmen}}

Erledigt am {{datum}} von {{bearbeiter}}.

Viele Grüße
4wändekanzlei Aufgabentool$t$
where key = 'aufgabe_erledigt_makler';

update email_templates set
  subject = 'Rückfrage: {{aufgabe}}',
  body = $t$Hallo {{empfaenger}},

{{bearbeiter}} hat die folgende Aufgabe zurückgestellt und wartet auf eine Rückmeldung.

{{rahmen}}

Rückfrage:
{{notiz}}

Bitte klärt kurz, wie es weitergeht.

Im Aufgabentool (für Kollegen mit Zugang):
{{link}}

Viele Grüße
4wändekanzlei Aufgabentool$t$
where key = 'in_bearbeitung_notiz';
