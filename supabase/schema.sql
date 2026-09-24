-- =====================================================================
-- Aufgabentool 4wändekanzlei – Supabase-Schema (Postgres 15)
-- Version 1.0 – Entwurf, September 2026
-- Region: eu-central-1 (Frankfurt)
--
-- Ausführen im Supabase SQL-Editor. Idempotent aufgebaut (IF NOT EXISTS),
-- damit Nachladen ohne Datenverlust möglich ist.
-- =====================================================================

create extension if not exists "pgcrypto";
-- pg_cron nur aktivieren, wenn es im Supabase-Dashboard unter Database > Extensions
-- freigeschaltet wurde. Wir planen die täglichen Läufe über Vercel Cron:
-- create extension if not exists "pg_cron";
create extension if not exists "citext";

-- ---------------------------------------------------------------------
-- 1. Aufzählungstypen
-- ---------------------------------------------------------------------
do $$ begin
  create type task_status   as enum ('offen', 'in_bearbeitung', 'erledigt');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_priority as enum ('normal', 'hoch');
exception when duplicate_object then null; end $$;

do $$ begin
  create type app_role      as enum ('superadmin', 'admin', 'mitarbeiter', 'gf', 'qm', 'user');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_source   as enum ('manuell', 'email', 'onoffice', 'qm');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notify_kind   as enum (
    'aufgabe_erledigt_makler',   -- Maklerkollege wird über Erledigung informiert
    'in_bearbeitung_notiz',      -- Pflichtnotiz an Verantwortlichen + Maklerkollege
    'erinnerung_3t',             -- Erinnerung an den Bearbeiter
    'eskalation_7t',             -- Eskalation an Bearbeiter + Ersteller/Admin
    'aufgabe_zugewiesen'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type notify_status as enum ('queued', 'sent', 'failed', 'skipped');
exception when duplicate_object then null; end $$;

do $$ begin
  create type mail_provider as enum ('onoffice', 'smtp', 'log');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attachment_origin as enum ('lokal', 'onoffice');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attachment_sync as enum (
    'lokal',          -- nur im Aufgabentool, Übertragung noch nicht angestoßen
    'wartet',         -- in der Warteschlange für den Upload nach onOffice
    'synchron',       -- in beiden Systemen, onoffice_file_id gesetzt
    'nur_onoffice',   -- hängt in onOffice an der Aufgabe, Inhalt liegt uns nicht vor
    'fehler'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 2. Benutzer und Rollen
--    profiles hängt 1:1 an auth.users (Supabase Auth)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  email             citext not null unique,
  full_name         text   not null,
  role              app_role not null default 'user',
  -- Verknüpfung in onOffice, z.B. "Lensinger, Eike (EL)"
  onoffice_user_id  text,
  onoffice_username text,
  color             text,                 -- Avatarfarbe für die Boards
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.profiles is 'Interne Benutzer des Aufgabentools inkl. Rolle und onOffice-Zuordnung.';

-- Maklerkollegen: kommen aus den onOffice-Benutzern, werden regelmäßig
-- synchronisiert. Sie brauchen keinen Login im Aufgabentool.
create table if not exists public.broker_contacts (
  id                uuid primary key default gen_random_uuid(),
  onoffice_user_id  text unique,
  display_name      text not null,        -- "Weis, Markus (mw)"
  short_code        text,                 -- "mw"
  email             citext not null,
  is_active         boolean not null default true,
  synced_at         timestamptz,
  created_at        timestamptz not null default now()
);

comment on table public.broker_contacts is 'Zuordenbare Maklerkollegen (Dropdown), gespeist aus der onOffice-Benutzerliste.';

-- ---------------------------------------------------------------------
-- 3. Kategorien (im Adminbereich frei pflegbar)
-- ---------------------------------------------------------------------
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  color       text not null default '#94a3b8',   -- Hex, im Adminbereich wählbar
  sort_order  integer not null default 100,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.categories is 'Frei konfigurierbare Aufgabenkategorien mit Farbe und Sortierung. Wird NICHT nach onOffice synchronisiert.';

-- ---------------------------------------------------------------------
-- 4. Aufgaben
-- ---------------------------------------------------------------------
create table if not exists public.tasks (
  id                    uuid primary key default gen_random_uuid(),
  title                 text not null check (length(btrim(title)) > 0),
  description           text,

  status                task_status   not null default 'offen',
  priority              task_priority not null default 'normal',
  category_id           uuid references public.categories(id) on delete set null,

  -- Rollen an der Aufgabe
  creator_id            uuid not null references public.profiles(id),   -- Verantwortlicher / Ersteller
  assignee_id           uuid references public.profiles(id),            -- Bearbeiter, NULL = im Pool
  broker_contact_id     uuid references public.broker_contacts(id),     -- zugeordneter Maklerkollege

  is_pool               boolean not null default false,
  is_private            boolean not null default false,

  -- Datumslogik
  visible_from          date not null default current_date,             -- Start-/Sichtbarkeitsdatum
  due_date              date,                                          -- optionale Fälligkeit

  -- onOffice-Bezug
  onoffice_estate_no    text,          -- Objektnummer
  onoffice_estate_id    text,          -- interne Objekt-ID (aus Auflösung der Nummer)
  onoffice_address_id   text,          -- alternativ Kundendatensatz
  onoffice_task_id      text unique,   -- Gegenstück in den onOffice-Aufgaben
  onoffice_synced_at    timestamptz,

  source                task_source not null default 'manuell',
  source_email_id       text,          -- Message-ID der Ursprungsmail

  -- Status-/Eskalationsspuren
  in_progress_note      text,                     -- letzte Pflichtnotiz
  last_status_change_at timestamptz not null default now(),
  completed_at          timestamptz,
  completed_by          uuid references public.profiles(id),
  reminder_3d_sent_at   timestamptz,
  escalation_7d_sent_at timestamptz,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  updated_by            uuid references public.profiles(id),

  -- Fachliche Invarianten
  constraint tasks_pool_ohne_bearbeiter
    check (not (is_pool and assignee_id is not null and status <> 'erledigt')),
  constraint tasks_private_ohne_makler
    check (not (is_private and broker_contact_id is not null)),
  constraint tasks_in_bearbeitung_braucht_notiz
    check (status <> 'in_bearbeitung' or (in_progress_note is not null and length(btrim(in_progress_note)) > 0)),
  constraint tasks_erledigt_hat_zeitstempel
    check (status <> 'erledigt' or completed_at is not null)
);

comment on constraint tasks_in_bearbeitung_braucht_notiz on public.tasks is
  'Pflichtnotiz: Der Status "In Bearbeitung" ist ohne Notiz auf Datenbankebene nicht speicherbar.';

create index if not exists tasks_assignee_status_idx on public.tasks (assignee_id, status);
create index if not exists tasks_visible_from_idx    on public.tasks (visible_from);
create index if not exists tasks_pool_idx            on public.tasks (is_pool) where assignee_id is null;
create index if not exists tasks_category_idx        on public.tasks (category_id);
create index if not exists tasks_estate_idx          on public.tasks (onoffice_estate_no);
create index if not exists tasks_offen_idx           on public.tasks (status, created_at) where status = 'offen';

-- ---------------------------------------------------------------------
-- 5. Notizen, Statushistorie, Audit
-- ---------------------------------------------------------------------
create table if not exists public.task_notes (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  author_id   uuid not null references public.profiles(id),
  body        text not null check (length(btrim(body)) > 0),
  is_status_note boolean not null default false,
  created_at  timestamptz not null default now()
);
-- Spiegelung ins Kommentarfeld der onOffice-Aufgabe
alter table public.task_notes
  add column if not exists onoffice_pushed_at timestamptz,
  add column if not exists onoffice_error     text;
create index if not exists task_notes_task_idx on public.task_notes (task_id, created_at desc);

-- Welche Rolle welchen Bereich im Menue sieht. Superadmin steht nicht
-- drin: er sieht immer alles.
-- Bereich der Geschaeftsfuehrung: gespiegelte Asana-Spalten
create table if not exists public.asana_sections (
  gid        text primary key,
  name       text not null,
  sort_order integer not null default 100,
  ist_pool   boolean not null default false,
  sichtbar   boolean not null default true,
  synced_at  timestamptz not null default now()
);

create table if not exists public.rollen_bereiche (
  role     app_role not null,
  bereich  text not null,
  sichtbar boolean not null default true,
  primary key (role, bereich)
);

-- Benachrichtigungen im Tool (Chatsymbol). Getrennt von notifications_log,
-- das die verschickten E-Mails protokolliert.
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  task_id    uuid references public.tasks(id) on delete cascade,
  note_id    uuid references public.task_notes(id) on delete cascade,
  kind       text not null default 'notiz',
  titel      text not null,
  text       text,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index if not exists notifications_offen_idx
  on public.notifications (user_id, created_at desc) where read_at is null;

create table if not exists public.task_status_history (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  from_status task_status,
  to_status   task_status not null,
  note        text,
  changed_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);
create index if not exists task_status_history_task_idx on public.task_status_history (task_id, created_at desc);

-- ---------------------------------------------------------------------
-- 5b. Dateianhänge
--     Inhalt liegt in Supabase Storage (Bucket 'task-attachments'),
--     hier stehen nur Metadaten und der Sync-Zustand zu onOffice.
-- ---------------------------------------------------------------------
create table if not exists public.task_attachments (
  id               uuid primary key default gen_random_uuid(),
  task_id          uuid not null references public.tasks(id) on delete cascade,

  file_name        text not null check (length(btrim(file_name)) > 0),
  mime_type        text,
  size_bytes       bigint check (size_bytes is null or size_bytes >= 0),
  -- Pfad im Bucket: <task_id>/<uuid>.<ext>; NULL nur bei 'nur_onoffice'
  storage_path     text unique,

  origin           attachment_origin not null default 'lokal',
  uploaded_by      uuid references public.profiles(id),

  -- onOffice-Gegenstück
  onoffice_file_id text,
  onoffice_art     text,          -- Parameter "Art" beim Zuordnen, z.B. 'Dokument'
  sync_state       attachment_sync not null default 'lokal',
  sync_error       text,
  synced_at        timestamptz,

  created_at       timestamptz not null default now(),

  constraint attachment_hat_inhalt_oder_ist_extern
    check (storage_path is not null or sync_state = 'nur_onoffice'),
  constraint attachment_synchron_braucht_onoffice_id
    check (sync_state <> 'synchron' or onoffice_file_id is not null)
);

create index if not exists task_attachments_task_idx on public.task_attachments (task_id, created_at);
create index if not exists task_attachments_sync_idx on public.task_attachments (sync_state)
  where sync_state in ('wartet', 'fehler');
create unique index if not exists task_attachments_onoffice_idx
  on public.task_attachments (task_id, onoffice_file_id) where onoffice_file_id is not null;

comment on table public.task_attachments is
  'Dateien an einer Aufgabe. Inhalt in Supabase Storage, Spiegelung nach onOffice über uploadfile (module=task).';

create table if not exists public.audit_log (
  id          bigserial primary key,
  entity      text not null,          -- 'task', 'category', 'settings', ...
  entity_id   text not null,
  action      text not null,          -- 'insert' | 'update' | 'delete'
  actor_id    uuid references public.profiles(id),
  diff        jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists audit_log_entity_idx on public.audit_log (entity, entity_id, created_at desc);

-- ---------------------------------------------------------------------
-- 6. E-Mail-Vorlagen, Einstellungen, Benachrichtigungsprotokoll
-- ---------------------------------------------------------------------
create table if not exists public.email_templates (
  key         text primary key,       -- s. notify_kind
  label       text not null,
  subject     text not null,
  body        text not null,          -- Platzhalter: {{titel}}, {{bearbeiter}}, {{notiz}}, {{link}}, {{objekt}}
  is_active   boolean not null default true,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id)
);

create table if not exists public.app_settings (
  id                       boolean primary key default true check (id),  -- Single-Row-Tabelle
  reminder_days            integer not null default 3,
  escalation_days          integer not null default 7,
  mail_provider            mail_provider not null default 'onoffice',
  onoffice_email_identity  text,       -- Pflichtparameter "emailidentity" der onOffice-API
  smtp_from                text,       -- Fallback-Absender
  done_hide_after_hours    integer not null default 24,   -- Ausblendfrist erledigter Aufgaben
  attachment_max_mb        integer not null default 25,   -- Obergrenze je Datei
  attachment_push_onoffice boolean not null default true, -- Anhänge nach onOffice spiegeln
  sync_push_inhalt         boolean not null default true, -- Betreff/Text/Frist/Prio zurückschreiben
  sync_push_neu            boolean not null default true, -- neue Aufgaben in onOffice anlegen
  sync_asana_onoffice      boolean not null default false, -- Asana-Aufgaben in onOffice anlegen
  attachment_default_art   text    not null default 'Dokument',
  workday_start_hour       integer not null default 7,
  timezone                 text not null default 'Europe/Berlin',
  updated_at               timestamptz not null default now()
);

-- Benachrichtigungsprotokoll: verhindert Doppelversand über dedupe_key
create table if not exists public.notifications_log (
  id             uuid primary key default gen_random_uuid(),
  task_id        uuid references public.tasks(id) on delete cascade,
  kind           notify_kind not null,
  recipient      citext not null,
  recipient_name text,
  subject        text not null,
  body           text not null,
  provider       mail_provider not null,
  status         notify_status not null default 'queued',
  provider_msg_id text,
  error          text,
  dedupe_key     text not null unique,   -- z.B. 'task:<uuid>:erinnerung_3t'
  created_at     timestamptz not null default now(),
  sent_at        timestamptz
);
create index if not exists notifications_log_task_idx on public.notifications_log (task_id, created_at desc);

comment on column public.notifications_log.dedupe_key is
  'Eindeutig pro Aufgabe und Anlass. Ein zweiter Versand desselben Anlasses schlägt am Unique-Index fehl statt doppelt zu mailen.';

-- ---------------------------------------------------------------------
-- 7. onOffice-Synchronisation
-- ---------------------------------------------------------------------
create table if not exists public.onoffice_sync_log (
  id          bigserial primary key,
  direction   text not null check (direction in ('pull', 'push')),
  resource    text not null,           -- 'task' | 'user' | 'estate' | 'sendmail'
  reference   text,
  ok          boolean not null,
  message     text,
  payload     jsonb,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 8. Trigger: updated_at, Statushistorie, Erledigungszeitpunkt
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_tasks_touch on public.tasks;
create trigger trg_tasks_touch before update on public.tasks
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_categories_touch on public.categories;
create trigger trg_categories_touch before update on public.categories
  for each row execute function public.touch_updated_at();

create or replace function public.handle_task_status_change() returns trigger
language plpgsql as $$
begin
  if new.status is distinct from old.status then
    new.last_status_change_at := now();

    if new.status = 'erledigt' then
      new.completed_at := coalesce(new.completed_at, now());
    else
      new.completed_at := null;
      new.completed_by := null;
    end if;

    -- Eskalationsuhr stoppt, sobald die Aufgabe nicht mehr nur "offen" ist
    if new.status <> 'offen' then
      new.reminder_3d_sent_at   := coalesce(new.reminder_3d_sent_at, now());
      new.escalation_7d_sent_at := coalesce(new.escalation_7d_sent_at, now());
    end if;

    insert into public.task_status_history (task_id, from_status, to_status, note, changed_by)
    values (new.id, old.status, new.status, new.in_progress_note, new.updated_by);
  end if;

  -- Übernahme aus dem Pool: sobald ein Bearbeiter gesetzt ist, verlässt die
  -- Aufgabe den unbesetzten Pool.
  if new.assignee_id is not null and old.assignee_id is null then
    new.is_pool := false;
  end if;

  return new;
end $$;

drop trigger if exists trg_tasks_status on public.tasks;
create trigger trg_tasks_status before update on public.tasks
  for each row execute function public.handle_task_status_change();

-- ---------------------------------------------------------------------
-- 9. Hilfsfunktionen für Rechte
-- ---------------------------------------------------------------------
create or replace function public.my_role() returns app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() in ('admin', 'superadmin'), false);
$$;

-- ---------------------------------------------------------------------
-- 10. Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.broker_contacts     enable row level security;
alter table public.categories          enable row level security;
alter table public.tasks               enable row level security;
alter table public.task_notes          enable row level security;
alter table public.task_attachments    enable row level security;
alter table public.task_status_history enable row level security;
alter table public.email_templates     enable row level security;
alter table public.app_settings        enable row level security;
alter table public.notifications_log   enable row level security;
alter table public.audit_log           enable row level security;
alter table public.onoffice_sync_log   enable row level security;

-- Profile: jeder sieht die Kollegenliste (für Zuordnung), ändern darf nur Admin
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_write on public.profiles;
create policy profiles_write on public.profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Maklerkollegen und Kategorien: lesen alle, schreiben nur Admin
drop policy if exists brokers_select on public.broker_contacts;
create policy brokers_select on public.broker_contacts
  for select to authenticated using (true);
drop policy if exists brokers_write on public.broker_contacts;
create policy brokers_write on public.broker_contacts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists categories_select on public.categories;
create policy categories_select on public.categories
  for select to authenticated using (true);
drop policy if exists categories_write on public.categories;
create policy categories_write on public.categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Aufgaben: Mitarbeitende sehen eigene Aufgaben + unbesetzten Pool.
-- Private Aufgaben sieht ausschließlich der Ersteller – auch der Admin nicht.
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks
  for select to authenticated using (
    case
      when is_private then creator_id = auth.uid()
      when public.is_admin() then true
      else assignee_id = auth.uid()
           or creator_id  = auth.uid()
           or (is_pool and assignee_id is null)
    end
  );

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks
  for insert to authenticated with check (
    creator_id = auth.uid()
    and (
      public.is_admin()                             -- Admin darf beliebig zuweisen
      or is_private                                 -- private Eigen-Aufgabe
      or assignee_id = auth.uid()                   -- Aufgabe für sich selbst
    )
  );

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
  for update to authenticated using (
    case
      when is_private then creator_id = auth.uid()
      when public.is_admin() then true
      else assignee_id = auth.uid()
           or creator_id  = auth.uid()
           or (is_pool and assignee_id is null)     -- Übernahme aus dem Pool
    end
  ) with check (
    case
      when public.is_admin() then true
      else assignee_id = auth.uid() or creator_id = auth.uid()
    end
  );

drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks
  for delete to authenticated using (public.is_admin() or creator_id = auth.uid());

-- Notizen und Historie folgen der Sichtbarkeit der Aufgabe
drop policy if exists task_notes_select on public.task_notes;
create policy task_notes_select on public.task_notes
  for select to authenticated using (
    exists (select 1 from public.tasks t where t.id = task_id)
  );
drop policy if exists task_notes_insert on public.task_notes;
create policy task_notes_insert on public.task_notes
  for insert to authenticated with check (author_id = auth.uid());

-- Anhänge erben die Sichtbarkeit der Aufgabe (die Unterabfrage greift selbst
-- auf tasks zu und wird damit von tasks_select gefiltert).
drop policy if exists attachments_select on public.task_attachments;
create policy attachments_select on public.task_attachments
  for select to authenticated using (
    exists (select 1 from public.tasks t where t.id = task_id)
  );

drop policy if exists attachments_insert on public.task_attachments;
create policy attachments_insert on public.task_attachments
  for insert to authenticated with check (
    uploaded_by = auth.uid()
    and exists (select 1 from public.tasks t where t.id = task_id)
  );

drop policy if exists attachments_update on public.task_attachments;
create policy attachments_update on public.task_attachments
  for update to authenticated using (
    public.is_admin() or exists (select 1 from public.tasks t where t.id = task_id)
  ) with check (true);

-- Löschen darf, wer die Datei hochgeladen hat, plus Admin
drop policy if exists attachments_delete on public.task_attachments;
create policy attachments_delete on public.task_attachments
  for delete to authenticated using (public.is_admin() or uploaded_by = auth.uid());

drop policy if exists status_history_select on public.task_status_history;
create policy status_history_select on public.task_status_history
  for select to authenticated using (
    exists (select 1 from public.tasks t where t.id = task_id)
  );

-- Vorlagen und Einstellungen: lesen alle, pflegen nur Admin
drop policy if exists templates_select on public.email_templates;
create policy templates_select on public.email_templates
  for select to authenticated using (true);
drop policy if exists templates_write on public.email_templates;
create policy templates_write on public.email_templates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists settings_select on public.app_settings;
create policy settings_select on public.app_settings
  for select to authenticated using (true);
drop policy if exists settings_write on public.app_settings;
create policy settings_write on public.app_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Protokolle: nur Admin
drop policy if exists notifications_select on public.notifications_log;
create policy notifications_select on public.notifications_log
  for select to authenticated using (public.is_admin());
drop policy if exists audit_select on public.audit_log;
create policy audit_select on public.audit_log
  for select to authenticated using (public.is_admin());
drop policy if exists sync_select on public.onoffice_sync_log;
create policy sync_select on public.onoffice_sync_log
  for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------
-- 11. Sichten für die Oberfläche
-- ---------------------------------------------------------------------
-- Tagesgeschäft: nur Aufgaben, deren Sichtbarkeitsdatum erreicht ist,
-- plus erledigte innerhalb der Ausblendfrist.
-- security_invoker: die Sicht rechnet mit den Rechten des Aufrufers, nicht
-- des Eigentuemers. Ohne das wuerde sie die Zeilensicherheit auf tasks
-- umgehen und jeder Mitarbeiter saehe alle Aufgaben.
create or replace view public.v_tagesgeschaeft
with (security_invoker = true) as
select t.*,
       c.name  as category_name,
       c.color as category_color,
       p.full_name as assignee_name,
       b.display_name as broker_name,
       b.email as broker_email
from public.tasks t
left join public.categories      c on c.id = t.category_id
left join public.profiles        p on p.id = t.assignee_id
left join public.broker_contacts b on b.id = t.broker_contact_id
where t.visible_from <= current_date
  and (
    t.status <> 'erledigt'
    or t.completed_at > now() - make_interval(hours => (select done_hide_after_hours from public.app_settings))
  );

-- Fällige Erinnerungen (3 Tage) – Basis für den Cron-Job
create or replace view public.v_faellige_erinnerungen
with (security_invoker = true) as
select t.id, t.title, t.assignee_id, t.creator_id, t.created_at
from public.tasks t, public.app_settings s
where t.status = 'offen'
  and not t.is_private
  and t.assignee_id is not null
  and t.reminder_3d_sent_at is null
  and t.visible_from <= current_date
  and t.created_at < now() - make_interval(days => s.reminder_days);

-- Fällige Eskalationen (7 Tage)
create or replace view public.v_faellige_eskalationen
with (security_invoker = true) as
select t.id, t.title, t.assignee_id, t.creator_id, t.created_at
from public.tasks t, public.app_settings s
where t.status = 'offen'
  and not t.is_private
  and t.escalation_7d_sent_at is null
  and t.visible_from <= current_date
  and t.created_at < now() - make_interval(days => s.escalation_days);

-- ---------------------------------------------------------------------
-- 12. Grundausstattung
-- ---------------------------------------------------------------------
insert into public.app_settings (id) values (true) on conflict (id) do nothing;

insert into public.categories (name, color, sort_order) values
  ('Aufbereitung',   '#eab308', 10),
  ('Buchhaltung',    '#3b82f6', 20),
  ('Vertrieb',       '#88cc44', 30),
  ('Qualitätsmanagement', '#a855f7', 40),
  ('Allgemein',      '#94a3b8', 90)
on conflict (name) do nothing;

insert into public.email_templates (key, label, subject, body) values
  ('aufgabe_erledigt_makler', 'Aufgabe erledigt (an Maklerkollegen)',
   'Aufgabe erledigt: {{titel}}',
   E'Hallo {{empfaenger}},\n\ndie Aufgabe "{{titel}}" ist erledigt.\n\nObjekt/Kunde: {{objekt}}\nErledigt von: {{bearbeiter}} am {{datum}}\n\nViele Grüße\n4wändekanzlei Aufgabentool'),
  ('in_bearbeitung_notiz', 'Rückmeldung bei "In Bearbeitung"',
   'Rückfrage zur Aufgabe: {{titel}}',
   E'Hallo {{empfaenger}},\n\n{{bearbeiter}} hat die Aufgabe "{{titel}}" auf "In Bearbeitung" gesetzt und folgende Notiz hinterlegt:\n\n{{notiz}}\n\nBitte klärt kurz, wie es weitergeht.\n\nViele Grüße\n4wändekanzlei Aufgabentool'),
  ('erinnerung_3t', 'Erinnerung nach 3 Tagen',
   'Erinnerung: {{titel}}',
   E'Hallo {{empfaenger}},\n\nhier hast du noch ein To-do: "{{titel}}".\nKläre gegebenenfalls Unstimmigkeiten oder Unklarheiten mit deinem Vorgesetzten oder dem beauftragten Vertriebler.\n\nViele Grüße\n4wändekanzlei Aufgabentool'),
  ('eskalation_7t', 'Eskalation nach 7 Tagen',
   'Weiterhin offen: {{titel}}',
   E'Hallo {{empfaenger}},\n\ndie Aufgabe "{{titel}}" ist seit {{tage}} Tagen offen und wurde weder erledigt noch auf "In Bearbeitung" gesetzt.\n\nBearbeiter: {{bearbeiter}}\nErstellt von: {{ersteller}}\n\nViele Grüße\n4wändekanzlei Aufgabentool')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- 13. Supabase Storage für Dateianhänge
--     Privater Bucket; Zugriff ausschließlich über die Policies unten.
--     Pfadkonvention: <task_id>/<uuid>.<ext>
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('task-attachments', 'task-attachments', false, 26214400)  -- 25 MB
on conflict (id) do nothing;

-- Hilfsfunktion: darf der aktuelle Benutzer die Aufgabe sehen, zu der
-- der erste Pfadsegment gehört? Nutzt bewusst die RLS-Sicht auf tasks.
create or replace function public.can_touch_task_file(object_name text)
returns boolean
language plpgsql stable security invoker as $$
declare
  tid uuid;
begin
  begin
    tid := (split_part(object_name, '/', 1))::uuid;
  exception when others then
    return false;   -- Pfad ohne gültige Aufgaben-ID
  end;
  return exists (select 1 from public.tasks t where t.id = tid);
end $$;

drop policy if exists task_files_select on storage.objects;
create policy task_files_select on storage.objects
  for select to authenticated
  using (bucket_id = 'task-attachments' and public.can_touch_task_file(name));

drop policy if exists task_files_insert on storage.objects;
create policy task_files_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'task-attachments' and public.can_touch_task_file(name));

drop policy if exists task_files_delete on storage.objects;
create policy task_files_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'task-attachments' and public.can_touch_task_file(name));

-- Hinweis: Downloads laufen über signierte URLs mit kurzer Laufzeit
-- (createSignedUrl), nicht über öffentliche Links.
