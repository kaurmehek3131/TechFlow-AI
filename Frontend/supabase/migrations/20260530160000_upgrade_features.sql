-- 1. Add fields to lessons for rubric, homework, and basic usage tracking
alter table public.lessons 
  add column if not exists rubric text,
  add column if not exists homework text,
  add column if not exists views_count integer not null default 0,
  add column if not exists shares_count integer not null default 0;

-- 2. Create lesson_versions table for tracking snapshots
create table if not exists public.lesson_versions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  version_number integer not null,
  title text not null,
  subject text,
  grade text,
  topic text,
  duration text,
  language text,
  objectives text,
  lesson_plan text,
  worksheet text,
  quiz text,
  answer_key text,
  rubric text,
  homework text,
  created_at timestamp with time zone default now(),
  created_by uuid references public.profiles(id) on delete set null
);

-- 3. Enable RLS on lesson_versions
alter table public.lesson_versions enable row level security;

-- 4. Set up security policies for lesson_versions
create policy "Users can view versions of their own lessons" 
  on public.lesson_versions for select 
  using (
    exists (
      select 1 from public.lessons 
      where lessons.id = lesson_versions.lesson_id 
      and lessons.user_id = auth.uid()
    )
  );

create policy "Users can insert versions of their own lessons" 
  on public.lesson_versions for insert 
  with check (
    exists (
      select 1 from public.lessons 
      where lessons.id = lesson_versions.lesson_id 
      and lessons.user_id = auth.uid()
    )
  );

create policy "Users can delete versions of their own lessons" 
  on public.lesson_versions for delete 
  using (
    exists (
      select 1 from public.lessons 
      where lessons.id = lesson_versions.lesson_id 
      and lessons.user_id = auth.uid()
    )
  );
