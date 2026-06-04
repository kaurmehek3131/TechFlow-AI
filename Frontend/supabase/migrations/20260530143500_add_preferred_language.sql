-- Add preferred_language column to public.profiles
alter table public.profiles
  add column if not exists preferred_language text not null default 'English';
