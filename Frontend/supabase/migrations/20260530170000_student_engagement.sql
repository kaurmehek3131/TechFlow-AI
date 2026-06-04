-- 1. Create assignments table
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  due_date timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- 2. Create submissions table
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  submitted_at timestamp with time zone default now(),
  answers text not null, -- JSON serialized answers
  score integer, -- Quiz percentage score if auto-graded
  status text not null default 'completed', -- 'completed', 'graded'
  feedback text
);

-- 3. Create student_progress table
create table if not exists public.student_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed_at timestamp with time zone default now(),
  quiz_score integer,
  quiz_total integer
);

-- 4. Create badges table
create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  badge_type text not null, -- 'first_lesson', 'quiz_master', 'weekly_learner', 'perfect_score', 'consistent_learner'
  awarded_at timestamp with time zone default now(),
  unique(student_id, badge_type)
);

-- 5. Create learning_recommendations table
create table if not exists public.learning_recommendations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  recommendations text not null, -- Markdown suggestions
  updated_at timestamp with time zone default now()
);

-- 6. Create study_plans table
create table if not exists public.study_plans (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  schedule text not null, -- Markdown schedule
  updated_at timestamp with time zone default now()
);

-- Enable RLS on all tables
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.student_progress enable row level security;
alter table public.badges enable row level security;
alter table public.learning_recommendations enable row level security;
alter table public.study_plans enable row level security;

-- Policies for assignments
create policy "Anyone can view assignments" on public.assignments for select using (true);
create policy "Teachers can insert assignments" on public.assignments for insert with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'teacher'));
create policy "Teachers can delete assignments" on public.assignments for delete using (teacher_id = auth.uid());

-- Policies for submissions
create policy "Users can view their own submissions or teachers can view submissions of their assignments" on public.submissions for select
  using (student_id = auth.uid() or exists (select 1 from public.assignments where id = submissions.assignment_id and teacher_id = auth.uid()));
create policy "Students can insert submissions" on public.submissions for insert with check (student_id = auth.uid());
create policy "Teachers can update submissions (for feedback)" on public.submissions for update using (exists (select 1 from public.assignments where id = submissions.assignment_id and teacher_id = auth.uid()));

-- Policies for student_progress
create policy "Students can view/insert their own progress" on public.student_progress using (student_id = auth.uid());
create policy "Students can insert progress" on public.student_progress for insert with check (student_id = auth.uid());

-- Policies for badges
create policy "Anyone can view badges" on public.badges for select using (true);
create policy "System triggers badges insert" on public.badges for insert with check (student_id = auth.uid());

-- Policies for recommendations & study plans
create policy "Students can view/insert their recommendations" on public.learning_recommendations using (student_id = auth.uid());
create policy "Students can view/insert their study plans" on public.study_plans using (student_id = auth.uid());
