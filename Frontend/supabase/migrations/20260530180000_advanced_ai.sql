-- 1. Add advanced AI columns to lessons table
alter table public.lessons 
  add column if not exists short_summary text,
  add column if not exists revision_notes text,
  add column if not exists exam_notes text,
  add column if not exists one_minute_review text,
  add column if not exists generated_questions text,
  add column if not exists blooms_taxonomy text,
  add column if not exists teaching_suggestions text;

-- 2. Create tutor_chats table for storing conversations
create table if not exists public.tutor_chats (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  message text not null,
  response text not null,
  created_at timestamp with time zone default now()
);

-- Enable RLS on tutor_chats
alter table public.tutor_chats enable row level security;

-- Policies for tutor_chats
create policy "Students can view/insert their own tutor messages" on public.tutor_chats 
  using (student_id = auth.uid());
create policy "Students can insert tutor messages" on public.tutor_chats for insert with check (student_id = auth.uid());
