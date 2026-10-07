-- =========================================================
-- 1. CREATE PROFILE AUTOMATICALLY WHEN AUTH USER IS CREATED
-- =========================================================
create or replace function public.handle_new_user () returns trigger language plpgsql security definer
set
  search_path = public as $$
begin
  insert into public.profiles (
    id,
    email,
    name,
    role
  )
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'name',
      new.email
    ),
    'framer'
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users for each row
execute function public.handle_new_user ();

-- =========================================================
-- 2. MANAGE SUBMISSION TIMESTAMPS AUTOMATICALLY
-- =========================================================
create or replace function public.handle_submission_update () returns trigger language plpgsql
set
  search_path = public as $$
begin
  -- Always update updated_at whenever the row changes
  new.updated_at = now();


  -- draft -> submitted
  -- Record the first time the form is submitted
  if old.status = 'draft'
     and new.status = 'submitted' then

    new.submitted_at = now();

  end if;


  -- submitted -> reviewed or rejected
  -- Record when the admin completes their review decision
  if old.status = 'submitted'
     and new.status in ('reviewed', 'rejected') then

    new.reviewed_at = now();

  end if;


  return new;
end;
$$;

drop trigger if exists on_submission_updated on public.submissions;

create trigger on_submission_updated before
update on public.submissions for each row
execute function public.handle_submission_update ();