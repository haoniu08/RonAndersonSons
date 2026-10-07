create extension if not exists "pgcrypto";

-- =========================
-- profiles
-- =========================
create table profiles (
  id uuid primary key references auth.users (id),
  email text,
  name text not null,
  role text not null check (role in ('framer', 'admin')),
  created_at timestamptz not null default now()
);

-- =========================
-- sites
-- =========================
create table sites (
  id uuid primary key default gen_random_uuid (),
  name text not null,
  address text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- =========================
-- submissions
-- =========================
create table submissions (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references profiles (id) on delete restrict,
  site_id uuid references sites (id) on delete restrict,
  submission_date date,
  -- Checklist fields are nullable while status = 'draft'
  ppe_worn boolean,
  fall_protection boolean,
  scaffolding_inspected boolean,
  tools_condition_good boolean,
  hazards_identified boolean,
  notes text,
  status text not null default 'draft' check (
    status in ('draft', 'submitted', 'reviewed', 'rejected')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  reviewed_at timestamptz
);

-- =========================
-- submission_photos
-- =========================
create table submission_photos (
  id uuid primary key default gen_random_uuid (),
  submission_id uuid not null references submissions (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  created_at timestamptz not null default now()
);