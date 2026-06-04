-- Add email column to profiles table
alter table public.profiles add column if not exists email text;

-- Update trigger function handle_new_user to insert user's email
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, full_name, avatar_url, role, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    new.raw_user_meta_data->>'avatar_url',
    coalesce(nullif(new.raw_user_meta_data->>'role',''), 'teacher')::public.user_role,
    new.email
  );
  return new;
end;
$function$;

-- Backfill emails for existing profiles from auth.users
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is null;

-- Drop strict role-based insert policy on assignments
drop policy if exists "Teachers can insert assignments" on public.assignments;

-- Create robust insert policy matching the authenticated user ID
create policy "Teachers can insert assignments" on public.assignments 
  for insert with check (teacher_id = auth.uid());
