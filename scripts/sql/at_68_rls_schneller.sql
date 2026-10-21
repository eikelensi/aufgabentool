-- at_68: Zugriffsregeln schneller - gleiche Regeln, nur einmal statt je Zeile ausgewertet.
--
-- auth.uid(), darf_alles() und is_admin() standen ungeklammert in den
-- Regeln. Postgres rief sie dann fuer JEDE Zeile neu auf - darf_alles()
-- ist eine Abfrage auf profiles. Beim Laden der Aufgabenliste waren das
-- rund 14.000 Aufrufe (1.200 Aufgaben plus 12.800 Verlaufszeilen, deren
-- Regel wiederum die Aufgabe prueft), knapp eine Sekunde je Ladevorgang.
-- In (select ...) gefasst rechnet Postgres sie einmal je Abfrage.
-- Wer was sehen darf, aendert sich dadurch nicht.
--
-- Dazu: doppelten Index auf tasks.asana_task_gid entfernen, fehlende
-- Indizes fuer haeufige Filter (creator_id in der Regel, task_id).
-- Unabhaengig vom Code, kann jederzeit eingespielt werden.

alter policy tasks_select on public.tasks using (
  case
    when is_private then creator_id = (select auth.uid())
    when (select public.darf_alles()) then true
    else assignee_id = (select auth.uid())
      or creator_id = (select auth.uid())
      or (is_pool and assignee_id is null)
  end
);

alter policy tasks_update on public.tasks
  using (
    case
      when is_private then creator_id = (select auth.uid())
      when (select public.darf_alles()) then true
      else assignee_id = (select auth.uid())
        or creator_id = (select auth.uid())
        or (is_pool and assignee_id is null)
    end
  )
  with check (
    case
      when (select public.darf_alles()) then true
      else assignee_id = (select auth.uid()) or creator_id = (select auth.uid())
    end
  );

alter policy tasks_insert on public.tasks with check (
  creator_id = (select auth.uid())
  and ((select public.darf_alles()) or is_private
       or assignee_id = (select auth.uid())
       or (is_pool and assignee_id is null))
);

alter policy tasks_delete on public.tasks using (
  (select public.is_admin()) or creator_id = (select auth.uid())
);

alter policy task_notes_insert on public.task_notes with check (
  author_id = (select auth.uid())
  and exists (select 1 from public.tasks t where t.id = task_notes.task_id)
);

alter policy attachments_insert on public.task_attachments with check (
  uploaded_by = (select auth.uid())
  and exists (select 1 from public.tasks t where t.id = task_attachments.task_id)
);

alter policy attachments_delete on public.task_attachments using (
  (select public.is_admin()) or uploaded_by = (select auth.uid())
);

alter policy notifications_select on public.notifications using (user_id = (select auth.uid()));
alter policy notifications_update on public.notifications
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy asana_listen_select on public.asana_listen using ((select auth.uid()) is not null);

alter policy mail_einstellungen_lesen on public.mail_einstellungen
  using (profile_id = (select auth.uid()) or (select public.darf_alles()));
alter policy mail_einstellungen_schreiben on public.mail_einstellungen
  using (profile_id = (select auth.uid()) or (select public.darf_alles()))
  with check (profile_id = (select auth.uid()) or (select public.darf_alles()));

drop index if exists public.tasks_asana_gid_idx;
create index if not exists tasks_creator_idx on public.tasks (creator_id);
create index if not exists notifications_task_idx on public.notifications (task_id);
create index if not exists task_events_task_idx on public.task_events (task_id);
