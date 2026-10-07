-- =========================================================
-- ENABLE ROW LEVEL SECURITY
-- =========================================================
alter table public.profiles enable row level security;

alter table public.sites enable row level security;

alter table public.submissions enable row level security;

alter table public.submission_photos enable row level security;

-- =========================================================
-- PRIVATE SECURITY HELPERS
-- =========================================================
create schema if not exists private;

create or replace function private.is_admin () returns boolean language sql security definer
set
  search_path = '' stable as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

-- SECURITY DEFINER functions are callable by PUBLIC by default,
-- so explicitly restrict execution.
revoke
execute on function private.is_admin ()
from
  public;

revoke
execute on function private.is_admin ()
from
  anon;

grant usage on schema private to authenticated;

grant
execute on function private.is_admin () to authenticated;

-- =========================================================
-- PROFILES
-- =========================================================
-- A framer may read their own profile.
-- An admin may read all profiles.
create policy "profiles_select_own_or_admin" on public.profiles for
select
  to authenticated using (
    id = (
      select
        auth.uid ()
    )
    or (
      select
        private.is_admin ()
    )
  );

-- Intentionally NO client-side UPDATE policy on profiles.
--
-- This prevents a framer from doing:
-- role = 'admin'
--
-- Admin role changes can be performed manually/server-side if needed.
-- =========================================================
-- SITES
-- =========================================================
-- Framers see active sites.
-- Admins may also see inactive historical sites.
create policy "sites_select_active_or_admin" on public.sites for
select
  to authenticated using (
    active = true
    or (
      select
        private.is_admin ()
    )
  );

-- Only admins may create sites.
create policy "sites_insert_admin" on public.sites for insert to authenticated
with
  check (
    (
      select
        private.is_admin ()
    )
  );

-- Only admins may update sites.
create policy "sites_update_admin" on public.sites
for update
  to authenticated using (
    (
      select
        private.is_admin ()
    )
  )
with
  check (
    (
      select
        private.is_admin ()
    )
  );

-- Only admins may delete sites.
--
-- In practice, sites should normally be set active = false instead.
-- Existing submission foreign keys also protect historical records.
create policy "sites_delete_admin" on public.sites for delete to authenticated using (
  (
    select
      private.is_admin ()
  )
);

-- =========================================================
-- SUBMISSIONS
-- =========================================================
-- Framers may read their own submissions.
-- Admins may read every submission.
create policy "submissions_select_own_or_admin" on public.submissions for
select
  to authenticated using (
    user_id = (
      select
        auth.uid ()
    )
    or (
      select
        private.is_admin ()
    )
  );

-- A framer may only create a submission belonging to themselves,
-- and new submissions must begin as drafts.
create policy "submissions_insert_own_draft" on public.submissions for insert to authenticated
with
  check (
    user_id = (
      select
        auth.uid ()
    )
    and status = 'draft'
  );

-- Framers may modify only their own CURRENT drafts.
--
-- Resulting status may remain draft or transition to submitted.
-- This prevents:
--
-- draft -> reviewed
-- draft -> rejected
create policy "submissions_update_own_draft" on public.submissions
for update
  to authenticated using (
    user_id = (
      select
        auth.uid ()
    )
    and status = 'draft'
  )
with
  check (
    user_id = (
      select
        auth.uid ()
    )
    and status in ('draft', 'submitted')
  );

-- Framers may delete their own drafts.
-- Submitted/reviewed/rejected records cannot be deleted through
-- this policy.
create policy "submissions_delete_own_draft" on public.submissions for delete to authenticated using (
  user_id = (
    select
      auth.uid ()
  )
  and status = 'draft'
);

-- Admins review submitted forms.
--
-- Old row must currently be submitted.
-- New row must become reviewed or rejected.
create policy "submissions_review_admin" on public.submissions
for update
  to authenticated using (
    (
      select
        private.is_admin ()
    )
    and status = 'submitted'
  )
with
  check (
    (
      select
        private.is_admin ()
    )
    and status in ('reviewed', 'rejected')
  );

-- =========================================================
-- SUBMISSION PHOTOS
-- =========================================================
-- Framers can read photos belonging to their own submissions.
-- Admins can read photos belonging to any submission.
create policy "photos_select_own_or_admin" on public.submission_photos for
select
  to authenticated using (
    exists (
      select
        1
      from
        public.submissions s
      where
        s.id = submission_id
        and (
          s.user_id = (
            select
              auth.uid ()
          )
          or (
            select
              private.is_admin ()
          )
        )
    )
  );

-- A framer may add photo metadata only to their own draft.
create policy "photos_insert_own_draft" on public.submission_photos for insert to authenticated
with
  check (
    exists (
      select
        1
      from
        public.submissions s
      where
        s.id = submission_id
        and s.user_id = (
          select
            auth.uid ()
        )
        and s.status = 'draft'
    )
  );

-- A framer may remove photo metadata while the submission
-- is still their own draft.
create policy "photos_delete_own_draft" on public.submission_photos for delete to authenticated using (
  exists (
    select
      1
    from
      public.submissions s
    where
      s.id = submission_id
      and s.user_id = (
        select
          auth.uid ()
      )
      and s.status = 'draft'
  )
);