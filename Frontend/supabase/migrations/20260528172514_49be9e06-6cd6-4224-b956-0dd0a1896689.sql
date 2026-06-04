
-- Role enum
do $$ begin
  create type public.user_role as enum ('teacher', 'student');
exception when duplicate_object then null; end $$;

-- Profile role
alter table public.profiles
  add column if not exists role public.user_role not null default 'teacher';

-- Lesson publishing
alter table public.lessons
  add column if not exists is_published boolean not null default false;

create index if not exists lessons_is_published_idx on public.lessons (is_published, created_at desc);

-- Public read access for published lessons (anon + authenticated)
drop policy if exists "Anyone can view published lessons" on public.lessons;
create policy "Anyone can view published lessons"
on public.lessons
for select
to anon, authenticated
using (is_published = true);

grant select on public.lessons to anon;

-- Update new-user trigger to capture role from signup metadata
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, full_name, avatar_url, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    new.raw_user_meta_data->>'avatar_url',
    coalesce(nullif(new.raw_user_meta_data->>'role',''), 'teacher')::public.user_role
  );
  return new;
end;
$function$;

-- Ensure trigger exists
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
