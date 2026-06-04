-- Add preferred_theme column to public.profiles
alter table public.profiles
  add column if not exists preferred_theme text not null default 'dark';
