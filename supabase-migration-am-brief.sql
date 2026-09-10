-- Qalara LMS — AM Daily Brief
-- Run once in Supabase → SQL Editor → New query → Run.
--
-- Adds three tables:
--   am_directory     — maps a Qalara login email to the AM's canonical name
--                      (the value stored in leads.current_am). Populate this
--                      yourself; an AM with no row here sees no brief.
--   am_assignments   — audit log: one row per lead per (re)assignment, written
--                      by /api/leads/assign-am and /api/leads/assign-am-bulk.
--   am_brief_state   — per-AM "last opened the brief" marker; the unread count
--                      is assignments newer than this (7-day fallback if unset).

create table if not exists am_directory (
  email      text primary key,
  am_name    text not null,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists am_assignments (
  id          bigint generated always as identity primary key,
  lead_id     bigint,
  lead_org    text,
  lead_email  text,
  segment     text,
  from_am     text,
  to_am       text not null,
  assigned_by text,
  assigned_at timestamptz not null default now()
);
create index if not exists am_assignments_to_am_idx
  on am_assignments (lower(to_am), assigned_at desc);

create table if not exists am_brief_state (
  am_name      text primary key,
  last_seen_at timestamptz not null default now()
);

-- Seed template — replace the placeholder emails with each AM's real Qalara
-- login, drop the AMs who don't need a brief, then run just this block.
--
-- insert into am_directory (email, am_name) values
--   ('gouri@qalara.com',   'Gouri Sree'),
--   ('dilip@qalara.com',   'Dilip BR'),
--   ('srijaa@qalara.com',  'Srijaa Sundararajan'),
--   ('roopali@qalara.com', 'Roopali Varma'),
--   ('gunjan@qalara.com',  'Gunjan Kumari'),
--   ('raina@qalara.com',   'Raina Singhwi'),
--   ('shivani@qalara.com', 'Shivani Verma'),
--   ('himanshu@qalara.com','Himanshu Sahu'),
--   ('prasad@qalara.com',  'Prasad Vaidyanathan'),
--   ('ashraf@qalara.com',  'Ashraf Hamid'),
--   ('sunny@qalara.com',   'Sunny Shah')
-- on conflict (email) do update set am_name = excluded.am_name, active = true;
