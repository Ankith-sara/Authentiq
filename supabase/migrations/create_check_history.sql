-- Create check_history table for syncing user history to Supabase
-- Run this in: Supabase Dashboard → SQL Editor

create table if not exists public.check_history (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid references public.profiles(id) on delete cascade not null,
  created_at                timestamptz default now() not null,

  -- Text
  text_preview              text not null,
  text_length               int not null,

  -- Combined score
  combined_originality_score int not null,

  -- Plagiarism
  plagiarism_score          numeric not null,
  originality_score         numeric not null,
  flagged_sentences         int not null,
  total_sentences           int not null,

  -- AI detection
  ai_probability            int not null,
  human_probability         int not null,
  ai_verdict                text not null,
  ai_confidence             text not null,
  perplexity                numeric not null,
  burstiness                numeric not null,

  -- Meta
  processing_ms             int not null,
  group_id                  uuid references public.groups(id) on delete set null
);

-- Index for fast user lookups sorted by time
create index if not exists check_history_user_created
  on public.check_history(user_id, created_at desc);

-- RLS
alter table public.check_history enable row level security;

drop policy if exists "Users can insert own history"  on public.check_history;
drop policy if exists "Users can select own history"  on public.check_history;
drop policy if exists "Users can delete own history"  on public.check_history;

create policy "Users can insert own history"
  on public.check_history for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can select own history"
  on public.check_history for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can delete own history"
  on public.check_history for delete
  to authenticated
  using (auth.uid() = user_id);
