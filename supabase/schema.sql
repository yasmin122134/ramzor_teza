-- רמזור תזה: יומן אישי בענן
-- 1. צרו פרויקט ב־Supabase.
-- 2. הדביקו את הקובץ הזה ב־SQL Editor והריצו. אפשר להריץ שוב בבטחה.
-- 3. Authentication → URL Configuration: הוסיפו את כתובת האתר ב־Vercel וגם http://127.0.0.1:5173
-- 4. העתיקו את Project URL ואת מפתח ה־anon אל .env.local ואל משתני הסביבה ב־Vercel:
--      VITE_SUPABASE_URL
--      VITE_SUPABASE_ANON_KEY

create table if not exists public.daily_entries (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  is_thesis_day boolean not null,
  work_mix jsonb not null,
  daily_goal text not null default '',
  output_score smallint,
  effective_hours numeric not null,
  quality_idle_hours numeric not null,
  bad_idle_hours numeric not null,
  balance_score smallint,
  balance_tags text[] not null default '{}',
  notes text not null default '',
  next_step_breadcrumb text not null default '',
  work_location text not null,
  social_context text not null,
  sleep_hours numeric not null default 7,
  updated_at timestamptz not null default now(),
  primary key (user_id, date),
  constraint daily_entries_location_check check (
    work_location in ('matlam_my_room', 'lab', 'other_room', 'batza', 'home_other')
  ),
  constraint daily_entries_social_check check (
    social_context in ('alone', 'body_doubling', 'collaborative')
  ),
  constraint daily_entries_output_check check (output_score is null or output_score between 0 and 4),
  constraint daily_entries_balance_check check (balance_score is null or balance_score between 0 and 2),
  constraint daily_entries_hours_check check (
    effective_hours between 0 and 16
    and quality_idle_hours between 0 and 16
    and bad_idle_hours between 0 and 16
  ),
  constraint daily_entries_sleep_check check (sleep_hours between 0 and 10)
);

create table if not exists public.week_records (
  user_id uuid not null references auth.users (id) on delete cascade,
  week_id date not null,
  target_weekly_hours numeric not null,
  top_achievement text not null default '',
  bottleneck text not null default '',
  next_first_step text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, week_id),
  constraint week_records_target_check check (target_weekly_hours between 1 and 80)
);

alter table public.daily_entries enable row level security;
alter table public.week_records enable row level security;

drop policy if exists daily_entries_owner on public.daily_entries;
create policy daily_entries_owner on public.daily_entries
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists week_records_owner on public.week_records;
create policy week_records_owner on public.week_records
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.daily_entries to authenticated;
grant select, insert, update, delete on public.week_records to authenticated;

alter table public.daily_entries add column if not exists sleep_hours numeric not null default 7;
alter table public.daily_entries drop constraint if exists daily_entries_sleep_check;
alter table public.daily_entries add constraint daily_entries_sleep_check check (sleep_hours between 0 and 10);
