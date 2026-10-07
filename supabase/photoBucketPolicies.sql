-- =========================================================
-- STORAGE: submission-photos
-- Path convention:
-- {user_id}/{submission_id}/{filename}
-- =========================================================
-- ---------------------------------------------------------
-- SELECT
-- Framer:
--   can read photos belonging to their own submissions
-- Admin:
--   can read all submission photos
-- ---------------------------------------------------------
create policy "storage_photos_select_own_or_admin" on storage.objects for
select
  to authenticated using (
    bucket_id = 'submission-photos'
    and exists (
      select
        1
      from
        public.submissions s
      where
        s.id::text = (storage.foldername (name)) [2]
        and (
          (
            -- Path user must match authenticated user
            (storage.foldername (name)) [1] = (
              select
                auth.uid ()
            )::text
            -- Submission must also belong to authenticated user
            and s.user_id = (
              select
                auth.uid ()
            )
          )
          or (
            select
              private.is_admin ()
          )
        )
    )
  );

-- ---------------------------------------------------------
-- INSERT
-- Framer may upload only to:
--   their own user folder
--   their own submission
--   while that submission is still draft
-- ---------------------------------------------------------
create policy "storage_photos_insert_own_draft" on storage.objects for insert to authenticated
with
  check (
    bucket_id = 'submission-photos'
    -- First folder must be the authenticated user's UUID
    and (storage.foldername (name)) [1] = (
      select
        auth.uid ()
    )::text
    and exists (
      select
        1
      from
        public.submissions s
      where
        s.id::text = (storage.foldername (name)) [2]
        and s.user_id = (
          select
            auth.uid ()
        )
        and s.status = 'draft'
    )
  );

-- ---------------------------------------------------------
-- DELETE
-- Framer may delete files only from:
--   their own folder
--   their own draft submission
-- ---------------------------------------------------------
create policy "storage_photos_delete_own_draft" on storage.objects for delete to authenticated using (
  bucket_id = 'submission-photos'
  and (storage.foldername (name)) [1] = (
    select
      auth.uid ()
  )::text
  and exists (
    select
      1
    from
      public.submissions s
    where
      s.id::text = (storage.foldername (name)) [2]
      and s.user_id = (
        select
          auth.uid ()
      )
      and s.status = 'draft'
  )
);